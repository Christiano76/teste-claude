import { describe, expect, it } from "vitest";
import { canonicalKey, parseSpecs } from "@/lib/hardware/specs";
import { REFERENCE } from "@/lib/scoring/market";
import { analyzeOffer, verdictOf, type ScoreContext } from "@/lib/scoring/score";
import { emptyOffer } from "@/lib/connectors/types";
import type { Offer } from "@/lib/types";

function offer(title: string, price: number, extra: Partial<Offer> = {}): Offer {
  const specs = parseSpecs(title, null, null);
  return {
    ...emptyOffer({ source: "test", externalId: title, title, url: "https://x.example", price, storeName: "KaBuM!" }),
    available: true, stockQty: 20, origin: "BR", taxesIncluded: true, freeShipping: true, warrantyText: "1 ano de garantia",
    id: 1, category: specs.category, specs, canonicalKey: canonicalKey(specs.category, specs, title, null),
    firstSeenAt: "", lastSeenAt: "", lastCheckedAt: "", ...extra,
  };
}

const ctx: ScoreContext = { store: { slug: "kabum", name: "KaBuM!", reputation: 82, reputation_basis: "teste" }, usdRate: 5.5, icmsRate: 0.2, pcCurve: REFERENCE.pc, monitorCurve: REFERENCE.monitor, priceInsight: null };

describe("pontuação", () => {
  it("faixas de veredito", () => {
    expect(verdictOf(95)).toBe("excelente");
    expect(verdictOf(80)).toBe("muito-bom");
    expect(verdictOf(65)).toBe("razoavel");
    expect(verdictOf(40)).toBe("pouco-recomendado");
  });

  it("PC equilibrado barato pontua mais que o mesmo PC caro", () => {
    const t = "PC Gamer Ryzen 5 5600, RTX 4060, 16gb Ddr4, SSD Nvme 1TB, Fonte 600w 80 Plus Bronze, B550";
    const cheap = analyzeOffer(offer(t, 3500), ctx);
    const dear = analyzeOffer(offer(t, 6500), ctx);
    expect(cheap.score).toBeGreaterThan(dear.score);
    expect(cheap.scores.custoBeneficio).toBeGreaterThanOrEqual(75);
    expect(cheap.scores.desconto!).toBeGreaterThan(dear.scores.desconto!);
  });

  it("preço absurdo vira suspeito e tem nota limitada", () => {
    const a = analyzeOffer(offer("PC Gamer i9 14900K, RTX 4090, 64gb Ddr5, SSD 2TB", 3000), ctx);
    expect(a.suspicious).toBe(true);
    expect(a.score).toBeLessThanOrEqual(39);
  });

  it("'gamer' com GT 210 recebe alerta", () => {
    const a = analyzeOffer(offer("PC Gamer Megaview, Intel i3-10100F, 8GB, SSD 240 GForce, GT210-1GB", 4500), ctx);
    expect(a.flags.map((f) => f.code)).toContain("fake-gamer");
    expect(a.score).toBeLessThan(60);
  });

  it("GPU desconhecida limita a nota a 59", () => {
    const a = analyzeOffer(offer("PC Gamer Intel Core i7 12700, 16gb, Placa De Vídeo Geforce 4gb, SSD 1TB", 2000), ctx);
    expect(a.score).toBeLessThanOrEqual(59);
  });

  it("fonte subdimensionada é sinalizada", () => {
    const a = analyzeOffer(offer("PC Gamer Ryzen 7 7700, RTX 4080, 32gb Ddr5, SSD 1TB, Fonte 400w", 9000), ctx);
    expect(a.flags.map((f) => f.code)).toContain("psu-weak");
  });

  it("produto internacional inclui impostos estimados no custo final", () => {
    const a = analyzeOffer(offer('Monitor Gamer 27" QHD 165Hz IPS 1ms', 800, { origin: "INTL", taxesIncluded: false, freeShipping: true }), ctx);
    expect(a.cost.importTax).toBeGreaterThan(0);
    expect(a.cost.total).toBeGreaterThan(800);
  });

  it("frete não informado marca custo como incompleto (não inventa)", () => {
    const a = analyzeOffer(offer('Monitor Gamer 24" FHD 180Hz IPS', 600, { freeShipping: false }), ctx);
    expect(a.cost.shipping).toBeNull();
    expect(a.cost.totalIsComplete).toBe(false);
  });
});

import { classifyCondition } from "@/lib/market/condition";
import { estimateMarket, type SamplePoint } from "@/lib/market/estimate";

describe("garimpo", () => {
  it("classifica o estado de conservação (títulos reais)", () => {
    expect(classifyCondition("Recondicionado - Monitor Gamer Acer Nitro Qg241y, 23.8", null, null)).toBe("recondicionado");
    expect(classifyCondition("Usado - PC Desktop Hp Elitedesk 800 G1 Sff i5-4590", null, null)).toBe("usado");
    expect(classifyCondition("Computador Hp Prodesk 400 G5 Intel Core i7-8700 (seminovo)", null, null)).toBe("seminovo");
    expect(classifyCondition("Monitor LG 24 Full HD", null, null, { openbox: true })).toBe("mostruario");
    expect(classifyCondition("Monitor LG 24 Full HD", null, null)).toBe("nao-informado");
    expect(classifyCondition("Monitor LG 24 Full HD", null, null, { storeSellsNewByDefault: true })).toBe("novo");
  });

  const sample: SamplePoint[] = Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, x: 100 + i, price: 4000 + i * 50, cond: "novo" as const, kit: false, cpu: 100 }));
  it("preço médio vem de comparáveis e é ajustado pelo estado", () => {
    const novo = estimateMarket({ id: 1, category: "pc", x: 102, kit: false, cpu: 100, cond: "novo", total: 3000, sample, curve: REFERENCE.pc, kitExtra: 0 });
    expect(novo.comparables).toBe(8);
    expect(novo.price).toBe(4175);
    expect(novo.discount).toBeCloseTo(1 - 3000 / 4175, 2);
    const usado = estimateMarket({ id: 1, category: "pc", x: 102, kit: false, cpu: 100, cond: "usado", total: 3000, sample, curve: REFERENCE.pc, kitExtra: 0 });
    expect(usado.price).toBe(Math.round(4175 * 0.68));
    expect(usado.discount!).toBeLessThan(novo.discount!);
  });
  it("não compara processadores de classes diferentes", () => {
    const r = estimateMarket({ id: 1, category: "pc", x: 102, kit: false, cpu: 30, cond: "novo", total: 3000, sample, curve: REFERENCE.pc, kitExtra: 0 });
    expect(r.comparables).toBe(0);
    expect(r.basis).toMatch(/curva/);
  });
  it("pagamento fora da plataforma = alto risco", () => {
    const a = analyzeOffer(offer("PC Gamer Ryzen 5 5600 RTX 4060 16gb SSD 1TB chama no zap pix direto", 3800), ctx);
    expect(a.risk.level).toBe("alto");
    expect(a.score).toBeLessThanOrEqual(35);
  });
  it("informações insuficientes são classificadas como tal", () => {
    const a = analyzeOffer(offer("PC Gamer Intel Core i5, Placa de Vídeo, SSD", 1500), ctx);
    expect(a.risk.level).toBe("insuficiente");
  });
  it("nunca afirma que é seguro", () => {
    const a = analyzeOffer(offer("PC Gamer Ryzen 5 5600, RTX 4060, 16gb Ddr4, SSD Nvme 1TB, Fonte 600w 80 Plus Bronze, B550", 4200), { ...ctx, sample: { pc: sample, monitor: [] } });
    expect(a.risk.reasons.join(" ")).not.toMatch(/(é|100%) seguro|compra garantida/i);
    if (a.risk.level === "baixo") expect(a.risk.reasons.join(" ")).toMatch(/não garante/);
  });
});
