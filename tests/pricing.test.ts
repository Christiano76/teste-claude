import { describe, expect, it } from "vitest";
import { parseFeed, parsePrice } from "@/lib/connectors/feed";
import { signAliexpress } from "@/lib/connectors/aliexpress";
import { priceInsight } from "@/lib/history/service";
import { estimateImportTaxes } from "@/lib/pricing/import-tax";
import { expectedPrice, fitCurve, REFERENCE } from "@/lib/scoring/market";

describe("impostos de importação", () => {
  it("até US$ 50: 20% + ICMS por dentro", () => {
    const t = estimateImportTaxes(250, 0, 5.5, 0.17); // ~US$ 45
    expect(t.importTax).toBe(50);
    expect(t.icms).toBeCloseTo((300 / 0.83) * 0.17, 1);
  });
  it("acima de US$ 50: 60% com dedução de US$ 20", () => {
    const t = estimateImportTaxes(1000, 100, 5, 0.2);
    expect(t.importTax).toBe(1100 * 0.6 - 100);
  });
});

describe("histórico de preços", () => {
  const day = 86400_000;
  const at = (d: number) => new Date(Date.now() - d * day).toISOString();
  it("histórico insuficiente não inventa conclusão", () => {
    const r = priceInsight([{ price: 100, listPrice: 200, capturedAt: at(0) }], 100, 200);
    expect(r.position).toBe("insuficiente");
    expect(r.fakeDiscount).toBe(false);
  });
  it("detecta preço 'de' nunca praticado", () => {
    const h = [10, 8, 6, 4, 2, 0].map((d) => ({ price: 1000, listPrice: 2000, capturedAt: at(d) }));
    const r = priceInsight(h, 1000, 2000);
    expect(r.fakeDiscount).toBe(true);
  });
  it("detecta aumento seguido de falsa promoção", () => {
    const h = [
      { price: 900, listPrice: null, capturedAt: at(50) },
      { price: 900, listPrice: null, capturedAt: at(40) },
      { price: 1100, listPrice: null, capturedAt: at(20) },
      { price: 1100, listPrice: null, capturedAt: at(10) },
      { price: 900, listPrice: 1100, capturedAt: at(1) },
    ];
    expect(priceInsight(h, 900, 1100).fakeDiscount).toBe(true);
  });
  it("reconhece mínimo histórico", () => {
    const h = [1200, 1150, 1100, 1000].map((p, i) => ({ price: p, listPrice: null, capturedAt: at(20 - i * 5) }));
    expect(priceInsight(h, 1000, null).position).toBe("otimo");
  });
});

describe("curva de mercado", () => {
  it("ajusta dados sintéticos e cai na referência com poucos pontos", () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({ x: 20 + i * 3, price: 50 * Math.pow(20 + i * 3, 0.9) }));
    const c = fitCurve(pts, REFERENCE.pc);
    expect(c.source).toBe("dados-coletados");
    expect(c.b).toBeCloseTo(0.9, 2);
    expect(fitCurve(pts.slice(0, 5), REFERENCE.pc).source).toBe("referencia");
    expect(expectedPrice(REFERENCE.pc, 100)).toBeCloseTo(4000, 0);
  });
});

describe("feeds de produtos", () => {
  it("lê Google Merchant XML", () => {
    const xml = `<rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:id>A1</g:id><g:title>Monitor Gamer LG 27" QHD 180Hz IPS</g:title><g:link>https://loja.example/a1</g:link><g:price>1.999,90 BRL</g:price><g:sale_price>1.499,90 BRL</g:sale_price><g:availability>in stock</g:availability><g:brand>LG</g:brand><g:shipping><g:price>0.00 BRL</g:price></g:shipping></item></channel></rss>`;
    const [o] = parseFeed(xml, { store: "Loja Teste", url: "file:///x" });
    expect(o).toMatchObject({ externalId: "A1", price: 1499.9, listPrice: 1999.9, available: true, brand: "LG", shippingCost: 0, storeName: "Loja Teste" });
  });
  it("lê CSV", () => {
    const csv = "id,title,link,price,availability\nX,PC Gamer Ryzen 5 5600 RTX 4060,https://l.example/x,4500.00 BRL,out of stock";
    const [o] = parseFeed(csv, { store: "L", url: "file:///x" });
    expect(o.price).toBe(4500);
    expect(o.available).toBe(false);
  });
  it("parsePrice entende formatos BR e internacional", () => {
    expect(parsePrice("R$ 1.234,56")).toBe(1234.56);
    expect(parsePrice("1234.56 BRL")).toBe(1234.56);
    expect(parsePrice("")).toBeNull();
  });
});

describe("assinaturas de API", () => {
  it("AliExpress: HMAC-SHA256 dos parâmetros ordenados, em maiúsculas", () => {
    const s = signAliexpress({ b: "2", a: "1" }, "segredo");
    expect(s).toMatch(/^[0-9A-F]{64}$/);
    expect(s).toBe(signAliexpress({ a: "1", b: "2" }, "segredo"));
  });
});
