import { describe, expect, it } from "vitest";
import { emptyOffer } from "@/lib/connectors/types";
import { canonicalKey, parseSpecs } from "@/lib/hardware/specs";
import { REFERENCE } from "@/lib/scoring/market";
import { analyzeOffer, deliveryInfo, type ScoreContext } from "@/lib/scoring/score";
import { deliveryTier } from "@/lib/search/service";
import type { Offer } from "@/lib/types";

function offer(title: string, price: number, extra: Partial<Offer> = {}): Offer {
  const specs = parseSpecs(title, null, null);
  return {
    ...emptyOffer({ source: "test", externalId: title, title, url: "https://x.example", price, storeName: "Loja" }),
    available: true, stockQty: 3, origin: "BR", taxesIncluded: true, condition: "usado", sellerType: "pessoa-fisica",
    id: 7, category: specs.category, specs, canonicalKey: canonicalKey(specs.category, specs, title, null),
    firstSeenAt: "", lastSeenAt: "", lastCheckedAt: "", ...extra,
  };
}
const ctx: ScoreContext = { store: null, usdRate: 5.4, icmsRate: 0.2, pcCurve: REFERENCE.pc, monitorCurve: REFERENCE.monitor, priceInsight: null, buyerUf: "SP" };
const wrap = (o: Offer, c: Partial<ScoreContext> = {}) => ({ offer: o, analysis: analyzeOffer(o, { ...ctx, ...c }), alsoAt: [] });

describe("modalidade de entrega", () => {
  it("envio local em outra UF não atende o comprador", () => {
    const d = deliveryInfo(offer("Monitor 24 Full HD 75hz", 180, { shipAvailable: true, shipScope: "local", sellerLocation: "RJ" }), "SP");
    expect(d.mode).toBe("envio-local");
    expect(d.deliverable).toBe(false);
  });
  it("envio local sem CEP do comprador fica não confirmado", () => {
    expect(deliveryInfo(offer("Monitor 24 Full HD 75hz", 180, { shipAvailable: true, shipScope: "local", sellerLocation: "RJ" }), null).deliverable).toBeNull();
  });
  it("retirada presencial não é tratada como envio", () => {
    const d = deliveryInfo(offer("Monitor 24 Full HD 75hz", 180, { pickup: true }), "SP");
    expect(d.mode).toBe("retirada");
    expect(d.deliverable).toBe(false);
  });
  it("sem informação = não confirmado (nunca inventa)", () => {
    expect(deliveryInfo(offer("Monitor 24 Full HD 75hz", 180), "SP").mode).toBe("nao-confirmado");
  });
});

describe("GARIMPO EXTREMO COM ENTREGA", () => {
  const pc = "PC Gamer usado i5 4590 GTX 1050 Ti 8gb SSD 240";
  it("PC de R$ 650 com envio entra na faixa até R$ 700", () => {
    expect(deliveryTier(wrap(offer(pc, 650, { shipAvailable: true, shipScope: "nacional", freeShipping: true })))).toBe("pc-700");
  });
  it("frete conhecido entra no custo total e muda a faixa", () => {
    expect(deliveryTier(wrap(offer(pc, 480, { shipAvailable: true, shipScope: "nacional", shippingCost: 60 })))).toBe("pc-700");
  });
  it("sem envio confirmado não entra", () => {
    expect(deliveryTier(wrap(offer(pc, 450, { pickup: true })))).toBeNull();
    expect(deliveryTier(wrap(offer(pc, 450)))).toBeNull();
  });
  it("alto risco não entra mesmo barato", () => {
    expect(deliveryTier(wrap(offer(`${pc} chama no zap pix direto`, 400, { shipAvailable: true, shipScope: "nacional", freeShipping: true })))).toBeNull();
  });
  it("monitor até R$ 200 e kit barato", () => {
    expect(deliveryTier(wrap(offer("Monitor 21.5 Full HD 75hz usado", 190, { shipAvailable: true, shipScope: "nacional", freeShipping: true })))).toBe("monitor-200");
    expect(deliveryTier(wrap(offer("Kit Upgrade I5 3470 + Placa H61 + 8GB DDR3", 320, { shipAvailable: true, shipScope: "nacional", freeShipping: true })))).toBe("kit-barato");
  });
  it("sempre recomenda pagar pela plataforma", () => {
    expect(wrap(offer(pc, 650, { shipAvailable: true })).analysis.risk.reasons.join(" ")).toMatch(/Não aceite PIX por fora/);
  });
});
