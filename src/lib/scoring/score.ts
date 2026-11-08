/**
 * Algoritmo de pontuação PC Hunter (0–100).
 *
 * Não premia apenas o mais barato: combina custo final, desempenho, qualidade
 * das peças, equilíbrio, reputação, garantia, estoque, frete/prazo, impostos e
 * potencial de upgrade. Quando um dado não pode ser verificado, a nota é
 * limitada e o motivo aparece em `flags`.
 */
import { findGpuByName } from "../hardware/gpus";
import { monitorQuality, pcPerformance, usageProfile } from "../hardware/performance";
import { estimateImportTaxes } from "../pricing/import-tax";
import { classifyCondition, CONDITION_LABEL } from "../market/condition";
import { estimateMarket, type SamplePoint } from "../market/estimate";
import type { Analysis, Condition, CostBreakdown, Flag, Offer, PriceInsight, RiskLevel, ScoreComponent, Verdict } from "../types";
import { clamp } from "../util/text";
import { expectedPrice, REFERENCE, type MarketCurve } from "./market";
import { type StoreRow, storeReputation, warrantyMonths } from "./reputation";
import { detectSuspicious } from "./suspicious";

export interface ScoreContext {
  store: StoreRow | null;
  usdRate: number | null;
  icmsRate: number;
  pcCurve: MarketCurve;
  monitorCurve: MarketCurve;
  kitCurve?: MarketCurve;
  /** UF do comprador (para entrega local). */
  buyerUf?: string | null;
  priceInsight: PriceInsight | null;
  /** Frete/prazo cotado para o CEP do usuário (sobrepõe os dados genéricos da oferta). */
  shippingQuote?: { cost: number | null; minDays: number | null; maxDays: number | null; source: string } | null;
  /** Amostra de anúncios para preço médio por comparáveis. */
  sample?: { pc: SamplePoint[]; monitor: SamplePoint[]; kit?: SamplePoint[]; peca?: SamplePoint[] };
  /** Quantos vendedores diferentes usam a mesma foto. */
  imageSellers?: number;
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
  let kitExtra = 0;

  if (o.category === "pc" && o.specs.pc) {
    const pc = o.specs.pc;
    const perf = pcPerformance(pc);
    performance = { gamingIndex: perf.gamingIndex, tierLabel: perf.tierLabel, perResolution: perf.perResolution, bottleneck: perf.bottleneck };

    if (perf.gamingIndex != null) {
      expected = expectedPrice(ctx.pcCurve, perf.gamingIndex);
      // Kits com monitor/periféricos: o preço esperado inclui um acréscimo pelo que vem junto
      if (pc.includesMonitor) kitExtra = pc.monitor ? expectedPrice(ctx.monitorCurve, monitorQuality(pc.monitor)) * 0.8 : 450;
      else if (pc.includesPeripherals) kitExtra = 120;
      expected += kitExtra;
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
    if (o.condition && ["usado", "seminovo", "recondicionado"].includes(o.condition)) q -= 6;
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
  } else if (o.category === "kit" && o.specs.pc) {
    const k = o.specs.pc;
    const kitCurve = ctx.kitCurve ?? REFERENCE.kit;
    const ci = k.cpu?.index ?? null;
    if (ci != null) {
      expected = expectedPrice(kitCurve, ci) * (k.ramGb ? 1 : 0.85) * (k.motherboard ? 1 : 0.6);
      components.push({ key: "valor", label: "Custo-benefício", weight: 0, value: Math.round(valueScore(expected, cost.total)), detail: `Preço final R$ ${cost.total.toFixed(0)} vs. ~R$ ${expected.toFixed(0)} por um kit com esse processador (${kitCurve.source === "dados-coletados" ? `curva de ${kitCurve.n} kits` : "curva de referência"}).` });
    } else {
      components.push({ key: "valor", label: "Custo-benefício", weight: 0, value: 30, detail: "Modelo do processador não informado." });
      caps.push(59);
    }
    let q = 70;
    const notes: string[] = [];
    if (!k.motherboard) { q -= 20; notes.push("sem placa-mãe (ou não informada)"); }
    if (!k.ramGb) { q -= 12; notes.push("sem memória (ou não informada)"); }
    if (k.ramType === "DDR3") { q -= 15; notes.push("DDR3 (plataforma obsoleta)"); }
    if (k.ramType === "DDR5") { q += 10; notes.push("DDR5"); }
    if (k.cpu?.generationAge === "obsolete") { q -= 15; notes.push("processador muito antigo"); }
    else if (k.cpu?.generationAge === "current") { q += 10; notes.push("processador atual"); }
    if (k.ramGb && k.ramGb >= 16) { q += 5; notes.push(`${k.ramGb} GB de RAM`); }
    components.push({ key: "qualidade", label: "Qualidade do kit", weight: 0, value: Math.round(clamp(q)), detail: notes.join("; ") || "Sem ressalvas nos dados informados." });
    const sock = k.cpu?.socket ?? k.motherboard?.socket ?? null;
    const up = sock === "AM5" ? 90 : sock === "LGA1851" ? 70 : sock === "AM4" ? 65 : sock === "LGA1700" ? 55 : sock === "LGA1200" ? 35 : sock ? 15 : 40;
    components.push({ key: "upgrade", label: "Potencial de upgrade", weight: 0, value: up, detail: sock ? `plataforma ${sock}` : "plataforma não identificada" });
    mq = ci;
  } else if (o.category === "peca" && o.specs.part) {
    const pt = o.specs.part;
    let q: number;
    let detail: string;
    if (pt.kind === "gpu" || pt.kind === "cpu") {
      q = pt.index == null ? 30 : Math.round(clamp((Math.log(Math.max(5, pt.index)) - Math.log(5)) / (Math.log(250) - Math.log(5)) * 100));
      detail = pt.index == null ? "Modelo não reconhecido na base de desempenho." : `${pt.model}: índice ${pt.index} (${pt.kind === "gpu" ? "RTX 4060" : "Ryzen 5 5600"} = 100).`;
    } else if (pt.kind === "ram" || pt.kind === "ssd") {
      const c = pt.capacity ?? 0;
      q = pt.kind === "ram" ? (c >= 32 ? 90 : c >= 16 ? 75 : c >= 8 ? 55 : 30) : (c >= 1000 ? 85 : c >= 480 ? 65 : c >= 240 ? 45 : 25);
      if (pt.detail === "DDR3") q -= 20;
      if (pt.detail === "NVMe") q += 10;
      detail = pt.model ?? "Capacidade não informada.";
    } else {
      q = pt.model ? 60 : 30;
      detail = pt.model ?? "Modelo não informado.";
    }
    components.push({ key: "qualidade", label: "Desempenho/capacidade da peça", weight: 0, value: Math.round(clamp(q)), detail });
    mq = pt.index ?? pt.capacity ?? null;
  }

  components.push({ key: "loja", label: "Confiabilidade da loja", weight: 0, value: rep.score, detail: rep.basis });
  components.push(warrantyComponent(o));
  components.push(availabilityComponent(o));
  components.push(deliveryComponent(o, ctx, cost.total));

  const weights: Record<string, number> = o.category === "pc"
    ? { valor: 30, desempenho: 14, qualidade: 12, equilibrio: 7, loja: 10, garantia: 6, estoque: 5, entrega: 10, upgrade: 6 }
    : o.category === "kit"
      ? { valor: 34, qualidade: 22, upgrade: 10, loja: 12, garantia: 7, estoque: 5, entrega: 10 }
      : o.category === "peca"
        ? { valor: 40, qualidade: 15, loja: 15, garantia: 10, estoque: 8, entrega: 12 }
        : { valor: 32, qualidade: 25, loja: 12, garantia: 9, estoque: 7, entrega: 15 };
  let score = 0;

  const condition: Condition = o.condition ?? classifyCondition(o.title, o.specsText, null);
  // 2) Desconto real contra o preço médio de comparáveis no mesmo estado
  const partKey = o.specs.part?.model ? `${o.specs.part.kind}:${o.specs.part.model.toLowerCase()}` : undefined;
  const x = o.category === "pc" ? performance?.gamingIndex ?? null : o.category === "peca" ? (partKey ? 1 : null) : mq;
  const sample = ctx.sample ? (o.category === "pc" ? ctx.sample.pc : o.category === "kit" ? ctx.sample.kit ?? [] : o.category === "peca" ? ctx.sample.peca ?? [] : ctx.sample.monitor) : [];
  // classificados (OLX/Enjoei) sem estado informado: comparados com o preço de USADOS (dito ao usuário na base do cálculo)
  const classifiedUnknown = condition === "nao-informado" && /^brave-(olx|enjoei)$/.test(o.source);
  const market = estimateMarket({
    id: o.id, category: o.category, x, kit: !!o.specs.pc?.includesMonitor,
    comp: o.category === "peca" ? partKey : o.category === "kit" ? `${o.specs.pc?.motherboard ? "placa" : "-"}|${o.specs.pc?.ramGb ? "ram" : "-"}|${o.specs.pc?.storage.length ? "ssd" : "-"}` : undefined, res: o.specs.monitor?.resolutionLabel, hz: o.specs.monitor?.refreshHz,
    panel: o.specs.monitor?.panel, cpu: o.specs.pc?.cpu?.index ?? null, cond: classifiedUnknown ? "usado" : condition, total: cost.total, sample, curve: o.category === "pc" ? ctx.pcCurve : o.category === "kit" ? ctx.kitCurve ?? REFERENCE.kit : o.category === "peca" ? REFERENCE.peca : ctx.monitorCurve, kitExtra,
  });
  if (o.category === "peca") {
    components.unshift(market.newPrice != null
      ? { key: "valor", label: "Custo-benefício", weight: 0, value: Math.round(valueScore(market.newPrice * (market.price! / market.newPrice), cost.total)), detail: `Preço final R$ ${cost.total.toFixed(0)} vs. ~R$ ${market.price} pela mesma peça (${market.basis}).` }
      : { key: "valor", label: "Custo-benefício", weight: 0, value: 45, detail: "Poucos anúncios do mesmo modelo para comparar." });
  }
  score = weighted(components, weights);
  if (classifiedUnknown && market.basis) market.basis += " (estado não informado em classificado: comparado como usado)";
  // Sinais de alerta
  // Preço de referência para golpe: o de anúncios comparáveis (no mesmo estado) quando houver; senão a curva
  const refPrice = market.comparables > 0 && market.price != null ? market.price : o.category === "pc" && o.specs.pc?.cpu?.index == null ? null : expected;
  flags.push(...detectSuspicious({ offer: o, expectedPrice: refPrice, totalCost: cost.total }));
  const suspicious = flags.some((f) => f.level === "danger" && ["too-cheap", "keyword", "defect"].includes(f.code));
  if (o.verification === "indice-busca") flags.push({ level: "info", code: "unverified", message: `Anúncio encontrado via buscador: preço do índice (${o.priceSource ?? "não confirmado"}), estoque e frete não verificados.` });
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
  const legacy = Math.round(clamp(score));

  // ---------- três notas independentes ----------
  // 1) Custo-benefício: tudo menos a confiabilidade da loja
  const cbWeights = { ...weights, loja: 0 };
  let cb = weighted(components.map((c) => ({ ...c })), cbWeights);
  const cbCaps = caps.filter((c) => c !== 39);
  if (cbCaps.length) cb = Math.min(cb, ...cbCaps);
  for (const c of components) c.weight = weights[c.key] ?? 0;

  let desconto = market.discount == null ? null : Math.round(clamp(35 + market.discount * 130));
  // sem anúncios comparáveis, a estimativa vem só da curva: confiança baixa
  if (desconto != null && market.comparables === 0) desconto = Math.min(desconto, 60);

  // 3) Confiabilidade + classificação de risco
  const reasons: string[] = [];
  let conf = rep.score;
  reasons.push(`Loja/vendedor: ${rep.label.toLowerCase()} (${rep.score}/100).`);
  if (o.sellerType === "pessoa-fisica") { conf -= 6; reasons.push("Vendedor pessoa física: sem estrutura de loja para trocas e garantia."); }
  if (o.sellerType === "profissional" && o.isMarketplace) reasons.push("Vendedor profissional (CNPJ) em marketplace.");
  const missing = o.specs.missing.length;
  const critical = o.specs.missing.filter((m) => /processador|placa de v[ií]deo|mem[oó]ria|armazenamento|resolu|frequ|tamanho/.test(m));
  if (missing) {
    conf -= Math.min(24, critical.length * 7 + (missing - critical.length) * 2);
    reasons.push(`${critical.length ? "Faltam dados importantes" : "Faltam detalhes"} no anúncio: ${o.specs.missing.slice(0, 4).join(", ")}.`);
  }
  const dangers = flags.filter((f) => f.level === "danger");
  // Só sinais de RISCO reduzem a confiabilidade; problemas de qualidade (plataforma antiga, gargalo) ficam no custo-benefício
  const RISK_WARN = new Set(["cheap-unknown-seller", "huge-discount", "bad-seller", "inconsistent", "fake-discount", "fake-gamer"]);
  const warns = flags.filter((f) => f.level === "warn" && RISK_WARN.has(f.code));
  conf -= Math.min(70, dangers.length * 35) + Math.min(18, warns.length * 5);
  for (const f of [...dangers, ...warns].slice(0, 4)) reasons.push(f.message);
  if (market.discount != null && market.discount > 0.55) { conf -= 20; reasons.push(`Preço ${Math.round(market.discount * 100)}% abaixo do mercado: descontos extremos exigem confirmar o produto e o vendedor.`); }
  if ((ctx.imageSellers ?? 0) >= 3) { conf -= o.sellerType === "pessoa-fisica" ? 15 : 5; reasons.push(`A mesma foto aparece em anúncios de ${ctx.imageSellers} vendedores diferentes (imagem genérica ou copiada).`); }
  if (condition !== "novo" && warrantyMonths(o.warrantyText).months == null) { conf -= 3; reasons.push("Item não novo sem garantia informada."); }
  if (o.available !== true) { conf -= 10; reasons.push(o.verification === "indice-busca" ? "Anúncio encontrado via buscador: preço, disponibilidade e frete precisam ser confirmados no anúncio." : "Disponibilidade não confirmada."); }
  if (o.protection) { conf += 4; reasons.push(`Proteção ao comprador: ${o.protection}.`); }
  else if (o.sellerType === "pessoa-fisica") { conf -= 6; reasons.push("Sem proteção ao comprador informada pela plataforma."); }
  conf = Math.round(clamp(conf));

  let level: RiskLevel;
  const insufficient = (o.category === "pc" && (performance?.gamingIndex == null || critical.length >= 2)) || (o.category === "monitor" && (!o.specs.monitor?.resolutionLabel || !o.specs.monitor?.refreshHz));
  // alto risco exige sinal concreto (golpe/pagamento por fora/preço absurdo) ou confiança muito baixa
  // alto risco = sinal concreto (golpe, pagamento por fora, preço absurdo, defeito); falta de dados = insuficiente
  if (dangers.length) level = "alto";
  else if (insufficient) level = "insuficiente";
  else if (conf < 25) level = "alto";
  else if (warns.length >= 1 || conf < 55) level = "atencao";
  else level = "baixo";
  if (level === "baixo") reasons.push("Nenhum sinal de risco encontrado nos dados disponíveis — isso não garante que o anúncio seja seguro.");
  reasons.push("Pague e combine o envio só pela plataforma. Não aceite PIX por fora, depósito antecipado ou negociação que tire a proteção ao comprador.");

  // Entrega para o comprador
  const delivery = deliveryInfo(o, ctx.buyerUf ?? null);
  if (delivery.deliverable === false && delivery.mode === "envio-local") flags.push({ level: "info", code: "local-only", message: delivery.label });

  // Nota geral
  let geral = 0.45 * cb + 0.25 * (desconto ?? 35) + 0.3 * conf;
  if (level === "alto") geral = Math.min(geral, 35);
  if (level === "insuficiente") geral = Math.min(geral, 55);
  geral = Math.round(clamp(geral));
  const final = geral;
  void legacy;
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
    delivery,
    usage: o.category === "pc" && o.specs.pc ? usageProfile(o.specs.pc) : null,
    verification: o.verification,
    condition,
    market,
    risk: { level, reasons },
    scores: { custoBeneficio: Math.round(clamp(cb)), desconto, confiabilidade: conf, geral },
    scoreNotes: {
      custoBeneficio: components.filter((c) => c.key !== "loja").sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => `${c.label}: ${c.value}`).join(" · "),
      desconto: market.price == null ? market.basis : `${market.discount! >= 0 ? `${Math.round(market.discount! * 100)}% abaixo` : `${Math.round(-market.discount! * 100)}% acima`} do preço médio estimado (${market.basis}).`,
      confiabilidade: reasons[0] ?? "",
    },
  };
}

export { CONDITION_LABEL };

/**
 * Modalidade de entrega como a fonte informou. Nunca presume envio:
 * sem confirmação da fonte, fica "nao-confirmado".
 */
export function deliveryInfo(o: Offer, buyerUf: string | null): Analysis["delivery"] {
  const sellerUf0 = o.sellerLocation?.toUpperCase().match(/\b([A-Z]{2})$/)?.[1] ?? null;
  const base = { program: o.shipProgram, protection: o.protection, pickup: o.pickup, nearBuyer: !!(buyerUf && sellerUf0 && sellerUf0 === buyerUf.toUpperCase()) };
  if (o.shipAvailable === true) {
    if (o.shipScope === "local") {
      const seller = o.sellerLocation?.toUpperCase().match(/\b[A-Z]{2}\b/)?.[0] ?? null;
      const deliverable = buyerUf && seller ? buyerUf.toUpperCase() === seller : null;
      return { ...base, mode: "envio-local", deliverable, label: deliverable === false ? `Envio só local (${seller}); não atende o seu CEP (${buyerUf}).` : `Envio local${seller ? ` (${seller})` : ""}${deliverable == null ? " — confirme se atende o seu CEP" : ""}.` };
    }
    if (o.shipScope === "internacional") return { ...base, mode: "internacional", deliverable: true, label: "Envio internacional para o Brasil." };
    return { ...base, mode: "envio-nacional", deliverable: true, label: `Envio para todo o Brasil${o.shipProgram ? ` (${o.shipProgram})` : ""}.` };
  }
  if (o.pickup === true) return { ...base, mode: "retirada", deliverable: false, label: "Somente retirada presencial (envio não informado)." };
  if (o.shipAvailable === false) return { ...base, mode: "sem-envio", deliverable: false, label: "Vendedor não faz envio." };
  const sellerUf = o.sellerLocation?.toUpperCase().match(/\b([A-Z]{2})$/)?.[1] ?? null;
  if (buyerUf && sellerUf && sellerUf === buyerUf.toUpperCase()) {
    return { ...base, mode: "nao-confirmado", deliverable: null, nearBuyer: true, label: `Frete não verificado — anúncio na sua região (${o.sellerLocation}); combine entrega ou retirada pela plataforma.` };
  }
  return { ...base, mode: "nao-confirmado", deliverable: null, label: "Frete não verificado." };
}
