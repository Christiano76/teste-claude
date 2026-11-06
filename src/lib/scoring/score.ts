/**
 * Algoritmo de pontuação PC Hunter (0–100).
 *
 * Não premia apenas o mais barato: combina custo final, desempenho, qualidade
 * das peças, equilíbrio, reputação, garantia, estoque, frete/prazo, impostos e
 * potencial de upgrade. Quando um dado não pode ser verificado, a nota é
 * limitada e o motivo aparece em `flags`.
 */
import { findGpuByName } from "../hardware/gpus";
import { monitorQuality, pcPerformance } from "../hardware/performance";
import { estimateImportTaxes } from "../pricing/import-tax";
import type { Analysis, CostBreakdown, Flag, Offer, PriceInsight, ScoreComponent, Verdict } from "../types";
import { clamp } from "../util/text";
import { expectedPrice, type MarketCurve } from "./market";
import { type StoreRow, storeReputation, warrantyMonths } from "./reputation";
import { detectSuspicious } from "./suspicious";

export interface ScoreContext {
  store: StoreRow | null;
  usdRate: number | null;
  icmsRate: number;
  pcCurve: MarketCurve;
  monitorCurve: MarketCurve;
  priceInsight: PriceInsight | null;
  /** Frete/prazo cotado para o CEP do usuário (sobrepõe os dados genéricos da oferta). */
  shippingQuote?: { cost: number | null; minDays: number | null; maxDays: number | null; source: string } | null;
}

export function verdictOf(score: number): Verdict {
  if (score >= 90) return "excelente";
  if (score >= 75) return "muito-bom";
  if (score >= 60) return "razoavel";
  return "pouco-recomendado";
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  excelente: "Excelente oportunidade",
  "muito-bom": "Muito bom",
  razoavel: "Razoável",
  "pouco-recomendado": "Pouco recomendado",
};

export function computeCost(o: Offer, ctx: ScoreContext): CostBreakdown {
  const notes: string[] = [];
  const fx = o.currency === "USD" ? ctx.usdRate : 1;
  const productPrice = fx ? o.price * fx : o.price;
  if (o.currency === "USD" && !ctx.usdRate) notes.push("Cotação do dólar indisponível — valor convertido não verificado.");

  let shipping: number | null = null;
  if (ctx.shippingQuote?.cost != null) {
    shipping = ctx.shippingQuote.cost;
    notes.push(`Frete cotado para o seu CEP (${ctx.shippingQuote.source}).`);
  } else if (o.freeShipping) {
    shipping = 0;
  } else if (o.shippingCost != null) {
    shipping = o.shippingCost;
  } else {
    notes.push("Frete não informado pela fonte — calcule na loja (não incluído no total).");
  }

  let importTax: number | null = null;
  let icms: number | null = null;
  if (o.origin === "INTL" && !o.taxesIncluded) {
    if (ctx.usdRate) {
      const t = estimateImportTaxes(productPrice, shipping ?? 0, ctx.usdRate, ctx.icmsRate);
      importTax = t.importTax;
      icms = t.icms;
      notes.push(...t.notes);
    } else {
      notes.push("Produto internacional: impostos de importação não puderam ser estimados (cotação indisponível).");
    }
  }
  const total = Math.round((productPrice + (shipping ?? 0) + (importTax ?? 0) + (icms ?? 0)) * 100) / 100;
  return { productPrice, shipping, importTax, icms, total, totalIsComplete: shipping != null && (o.origin !== "INTL" || o.taxesIncluded === true || importTax != null), notes, fxRate: o.currency === "USD" ? ctx.usdRate : null };
}

/** Valor = preço esperado pelo mercado ÷ custo final, em escala log. ratio 1 → 65 pontos. */
function valueScore(expected: number, total: number): number {
  return clamp(65 + 55 * Math.log(expected / total));
}

function deliveryComponent(o: Offer, ctx: ScoreContext, total: number): ScoreComponent {
  const q = ctx.shippingQuote;
  const maxDays = q?.maxDays ?? o.delivery?.maxDays ?? null;
  const src = q?.maxDays != null ? q.source : o.delivery?.source;
  let d: number;
  let detail: string;
  if (maxDays != null) {
    d = maxDays <= 2 ? 100 : maxDays <= 5 ? 85 : maxDays <= 10 ? 65 : maxDays <= 20 ? 40 : 20;
    detail = `Prazo informado: até ${maxDays} dia(s) (${src}).`;
  } else if (o.origin === "INTL") {
    d = 20;
    detail = "Envio internacional sem prazo verificado.";
  } else {
    d = 50;
    detail = o.origin === "BR" ? "Envio do Brasil; prazo não informado pela fonte." : "Origem e prazo não verificados.";
  }
  const cost = q?.cost ?? (o.freeShipping ? 0 : o.shippingCost);
  const c = cost == null ? 50 : cost === 0 ? 100 : clamp(100 - (cost / total) * 1000);
  detail += cost == null ? " Frete não verificado." : cost === 0 ? " Frete grátis." : ` Frete R$ ${cost.toFixed(2)}.`;
  return { key: "entrega", label: "Entrega e frete", weight: 0, value: Math.round(0.6 * d + 0.4 * c), detail };
}

function availabilityComponent(o: Offer): ScoreComponent {
  let v: number;
  let detail: string;
  if (o.available === false) [v, detail] = [0, "Indisponível na fonte."];
  else if (o.available == null) [v, detail] = [40, "Estoque não confirmado pela fonte."];
  else if (o.stockQty != null && o.stockQty < 5) [v, detail] = [80, `Em estoque — poucas unidades (${o.stockQty}).`];
  else [v, detail] = [100, o.stockQty != null ? `Em estoque (${o.stockQty} un.).` : "Em estoque."];
  return { key: "estoque", label: "Disponibilidade", weight: 0, value: v, detail };
}

function warrantyComponent(o: Offer): ScoreComponent {
  const w = warrantyMonths(o.warrantyText);
  const m = w.months;
  const v = m == null ? 40 : m >= 36 ? 100 : m >= 24 ? 90 : m >= 12 ? 72 : m >= 6 ? 50 : 30;
  return { key: "garantia", label: "Garantia", weight: 0, value: v, detail: w.label };
}

function weighted(components: ScoreComponent[], weights: Record<string, number>): number {
  let sum = 0;
  let wsum = 0;
  for (const c of components) {
    const w = weights[c.key] ?? 0;
    c.weight = w;
    sum += c.value * w;
    wsum += w;
  }
  return wsum ? sum / wsum : 0;
}

export function analyzeOffer(o: Offer, ctx: ScoreContext): Analysis {
  const cost = computeCost(o, ctx);
  const flags: Flag[] = [];
  const components: ScoreComponent[] = [];
  const rep = storeReputation(o, ctx.store);
  let caps: number[] = [];
  let expected: number | null = null;
  let performance: Analysis["performance"] = null;
  let mq: number | null = null;

  if (o.category === "pc" && o.specs.pc) {
    const pc = o.specs.pc;
    const perf = pcPerformance(pc);
    performance = { gamingIndex: perf.gamingIndex, tierLabel: perf.tierLabel, perResolution: perf.perResolution, bottleneck: perf.bottleneck };

    if (perf.gamingIndex != null) {
      expected = expectedPrice(ctx.pcCurve, perf.gamingIndex);
      // Kits com monitor/periféricos: o preço esperado inclui um acréscimo pelo que vem junto
      if (pc.includesMonitor) expected += pc.monitor ? expectedPrice(ctx.monitorCurve, monitorQuality(pc.monitor)) * 0.8 : 450;
      else if (pc.includesPeripherals) expected += 120;
      const v = valueScore(expected, cost.total);
      components.push({ key: "valor", label: "Custo-benefício", weight: 0, value: Math.round(v), detail: `Preço final R$ ${cost.total.toFixed(0)} vs. ~R$ ${expected.toFixed(0)} cobrado pelo mercado (${ctx.pcCurve.source === "dados-coletados" ? `curva de ${ctx.pcCurve.n} ofertas coletadas` : "curva de referência"}) por esse desempenho.` });
      components.push({ key: "desempenho", label: "Desempenho em jogos", weight: 0, value: Math.round(clamp((Math.log(Math.max(5, perf.gamingIndex)) - Math.log(5)) / (Math.log(250) - Math.log(5)) * 100)), detail: `${perf.tierLabel} (índice ${perf.gamingIndex}; RTX 4060 + Ryzen 5 5600 ≈ 100).` });
    } else {
      components.push({ key: "valor", label: "Custo-benefício", weight: 0, value: 30, detail: "Não foi possível estimar o desempenho (modelo da placa de vídeo não informado)." });
      components.push({ key: "desempenho", label: "Desempenho em jogos", weight: 0, value: 30, detail: "Desempenho não verificável." });
      caps.push(59);
      flags.push({ level: "warn", code: "perf-unknown", message: "Modelo da placa de vídeo não informado — desempenho não verificável." });
    }

    // Qualidade das peças
    let q = 75;
    const notes: string[] = [];
    const gpuRef = pc.gpu && !pc.gpu.integrated ? findGpuByName(pc.gpu.model) : null;
    const draw = perf.estimatedDrawW;
    if (!pc.psu) { q -= 12; notes.push("fonte não especificada (pode ser genérica)"); }
    else {
      if (!pc.psu.rating) { q -= 8; notes.push("fonte sem certificação informada"); }
      else if (/gold|platinum|titanium/i.test(pc.psu.rating)) { q += 10; notes.push(`fonte ${pc.psu.rating}`); }
      else if (/bronze/i.test(pc.psu.rating)) { q += 5; notes.push(`fonte ${pc.psu.rating}`); }
      if (pc.psu.watts && draw && pc.psu.watts < draw * 1.15) {
        q -= 20;
        flags.push({ level: "danger", code: "psu-weak", message: `Fonte de ${pc.psu.watts} W é subdimensionada para ${gpuRef?.name ?? "a configuração"} (consumo estimado ~${draw} W).` });
      }
    }
    if (pc.storage.length === 0) { q -= 5; notes.push("armazenamento não informado"); }
    else if (pc.storage.every((s) => s.type === "hdd")) { q -= 20; notes.push("apenas HD mecânico"); flags.push({ level: "warn", code: "hdd-only", message: "Somente HD mecânico — sistema e jogos ficam lentos." }); }
    else {
      const ssdGb = pc.storage.filter((s) => s.type !== "hdd").reduce((s, x) => s + x.gb, 0);
      if (ssdGb < 480) { q -= 8; notes.push(`SSD pequeno (${ssdGb} GB)`); }
      if (pc.storage.some((s) => s.type === "nvme")) { q += 4; notes.push("SSD NVMe"); }
    }
    if (pc.ramType === "DDR3") { q -= 15; notes.push("memória DDR3 (obsoleta)"); }
    if (pc.ramGb != null && pc.ramGb < 16) { q -= 8; notes.push(`apenas ${pc.ramGb} GB de RAM`); }
    if (pc.ramGb == null) { q -= 5; notes.push("RAM não informada"); }
    if (pc.cpu?.generationAge === "obsolete") { q -= 18; notes.push("processador muito antigo"); }
    else if (pc.cpu?.generationAge === "old") { q -= 7; notes.push("processador de geração antiga"); }
    if (!pc.cpu || pc.cpu.index == null) { q -= 10; notes.push("modelo do processador não informado"); flags.push({ level: "warn", code: "cpu-unknown", message: "Modelo exato do processador não informado — peça essa informação ao vendedor." }); }
    if (pc.gpu?.integrated) { q -= 10; notes.push("sem placa de vídeo dedicada"); }
    if (o.condition === "used" || o.condition === "refurbished") q -= 8;
    components.push({ key: "qualidade", label: "Qualidade das peças", weight: 0, value: Math.round(clamp(q)), detail: notes.length ? notes.join("; ") + "." : "Componentes sem ressalvas nos dados informados." });

    // Equilíbrio
    const bal = perf.cpuFactor == null ? 60 : clamp(perf.cpuFactor * 100 - (pc.gpu && pc.gpu.index != null && pc.cpu?.index && pc.gpu.index < 25 && pc.cpu.index >= 80 ? 30 : 0));
    components.push({ key: "equilibrio", label: "Equilíbrio CPU/GPU/RAM", weight: 0, value: Math.round(bal * perf.ramFactor), detail: perf.bottleneck ?? "Componentes bem proporcionais." });
    if (perf.bottleneck && perf.cpuFactor != null && perf.cpuFactor < 0.85) flags.push({ level: "warn", code: "bottleneck", message: perf.bottleneck });

    // Upgrade
    const sock = pc.cpu?.socket ?? pc.motherboard?.socket ?? null;
    let up = sock === "AM5" ? 90 : sock === "LGA1851" ? 70 : sock === "AM4" ? 60 : sock === "LGA1700" ? 55 : sock === "LGA1200" ? 35 : sock ? 15 : 40;
    const upNotes = [sock ? `plataforma ${sock}` : "plataforma não identificada"];
    if (pc.psu?.watts && draw) {
      const head = pc.psu.watts - draw;
      if (head >= 200) { up += 10; upNotes.push(`fonte com folga (~${Math.round(head)} W) para GPU melhor`); }
      else if (head < 60) { up -= 15; upNotes.push("fonte sem folga para upgrade de GPU"); }
    } else if (!pc.psu?.watts) upNotes.push("potência da fonte desconhecida");
    if (pc.ramType === "DDR5") { up += 5; upNotes.push("DDR5"); }
    const chip = pc.motherboard?.chipset;
    if (chip && /^(A320|A520|A620|H610|H510|H410|H310|H81|H110)$/.test(chip)) { up -= 10; upNotes.push(`chipset de entrada ${chip}`); }
    else if (chip && /^(B550|B650E?|B760|B850|B860|X570|X670E?|X870E?|Z690|Z790|Z890)$/.test(chip)) { up += 5; upNotes.push(`chipset ${chip}`); }
    components.push({ key: "upgrade", label: "Potencial de upgrade", weight: 0, value: Math.round(clamp(up)), detail: upNotes.join("; ") + "." });

    if (pc.includesMonitor) flags.push({ level: "info", code: "kit-monitor", message: `Kit inclui monitor${pc.monitor?.sizeIn ? ` de ${pc.monitor.sizeIn}"` : ""}${pc.includesPeripherals ? " e periféricos" : ""}.` });
  } else if (o.category === "monitor" && o.specs.monitor) {
    const m = o.specs.monitor;
    mq = monitorQuality(m);
    expected = expectedPrice(ctx.monitorCurve, mq);
    components.push({ key: "valor", label: "Custo-benefício", weight: 0, value: Math.round(valueScore(expected, cost.total)), detail: `Preço final R$ ${cost.total.toFixed(0)} vs. ~R$ ${expected.toFixed(0)} cobrado pelo mercado (${ctx.monitorCurve.source === "dados-coletados" ? `curva de ${ctx.monitorCurve.n} ofertas` : "curva de referência"}) por essas especificações.` });
    const spec = [m.sizeIn && `${m.sizeIn}"`, m.resolutionLabel, m.refreshHz && `${m.refreshHz} Hz`, m.panel, m.responseMs != null && `${m.responseMs} ms`, m.adaptiveSync].filter(Boolean).join(" · ");
    components.push({ key: "qualidade", label: "Qualidade do monitor", weight: 0, value: mq, detail: spec || "Especificações não informadas." });
    if (!m.resolutionLabel || !m.refreshHz) {
      caps.push(65);
      flags.push({ level: "warn", code: "monitor-specs", message: "Resolução ou frequência não informadas no anúncio." });
    }
  }

  components.push({ key: "loja", label: "Confiabilidade da loja", weight: 0, value: rep.score, detail: rep.basis });
  components.push(warrantyComponent(o));
  components.push(availabilityComponent(o));
  components.push(deliveryComponent(o, ctx, cost.total));

  const weights: Record<string, number> = o.category === "pc"
    ? { valor: 30, desempenho: 14, qualidade: 12, equilibrio: 7, loja: 10, garantia: 6, estoque: 5, entrega: 10, upgrade: 6 }
    : { valor: 32, qualidade: 25, loja: 12, garantia: 9, estoque: 7, entrega: 15 };
  let score = weighted(components, weights);

  // Sinais de alerta
  flags.push(...detectSuspicious({ offer: o, expectedPrice: expected, totalCost: cost.total }));
  const suspicious = flags.some((f) => f.level === "danger" && ["too-cheap", "keyword"].includes(f.code));
  if (suspicious) caps.push(39);
  if (flags.some((f) => f.code === "psu-weak")) caps.push(55);
  if (o.available === false) caps.push(30);
  if (o.origin === "INTL") flags.push({ level: "info", code: "intl", message: "Produto internacional: prazo maior e impostos de importação estimados." });
  if (!cost.totalIsComplete) flags.push({ level: "info", code: "cost-incomplete", message: "Custo final incompleto (frete ou impostos não verificados)." });
  if (ctx.priceInsight?.fakeDiscount) {
    flags.push({ level: "warn", code: "fake-discount", message: ctx.priceInsight.message });
    score -= 5;
  }
  if (ctx.priceInsight?.position === "otimo") score += 3;
  if (ctx.priceInsight?.position === "alto") score -= 3;

  caps = caps.filter((c) => c < score);
  if (caps.length) score = Math.min(...caps);
  const final = Math.round(clamp(score));
  return {
    score: final,
    verdict: verdictOf(final),
    components,
    flags,
    cost,
    performance,
    monitorQuality: mq ?? (o.specs.pc?.monitor ? monitorQuality(o.specs.pc.monitor) : null),
    storeReputation: rep,
    priceInsight: ctx.priceInsight,
    suspicious,
  };
}
