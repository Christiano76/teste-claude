/**
 * Testes de cada conector, com respostas no formato real de cada fonte.
 * KaBuM!: amostra trimada de resposta real (06/11/2026).
 * Mercado Livre: formato documentado de /sites/MLB/search (sem token não há como testar ao vivo).
 */
import { describe, expect, it } from "vitest";
import { enjoei, facebook, olx } from "@/lib/connectors/classificados";
import { parseBool, parseFeed } from "@/lib/connectors/feed";
import { mapKabumItem, type KabumItem } from "@/lib/connectors/kabum";
import { mapMlItem, type MlItem } from "@/lib/connectors/mercadolivre";
import { activeConnectors, CONNECTORS } from "@/lib/connectors/registry";
import { parseSpecs } from "@/lib/hardware/specs";

const kabumBase: KabumItem = {
  id: 684007,
  attributes: {
    title: "PC Gamer Completo Ryzen 5 5600gt, 16gb Ddr4, SSD 480GB, 500w 80 Plus, PCgt13-e",
    menu: "Computadores/PC/PC Gamer/PC Gamer Completo",
    price: 4964.11, old_price: 0, price_with_discount: 4368.42, offer: null, available: true, stock: 45,
    warranty: "Sem Garantia", has_free_shipping: true, is_marketplace: true, is_openbox: false,
    marketplace: { seller_name: "FLER EQUIPAMENTOS", state: "SC", seller_sale_pj: true },
    manufacturer: { name: "ENIFLER" }, images: ["https://images.kabum.com.br/x.png"],
    product_link: "pc-gamer-completo", score_of_ratings: 5, number_of_ratings: 6,
  },
};

describe("conector KaBuM!", () => {
  it("mapeia preço à vista, vendedor, UF, envio e proteção", () => {
    const o = mapKabumItem(kabumBase, "pc")!;
    expect(o.price).toBe(4368.42);
    expect(o.installmentPrice).toBe(4964.11);
    expect(o.sellerType).toBe("profissional");
    expect(o.sellerLocation).toBe("SC");
    expect(o.shipAvailable).toBe(true);
    expect(o.shipScope).toBe("nacional");
    expect(o.condition).toBe("novo");
    expect(o.protection).toMatch(/CDC/);
    expect(o.url).toBe("https://www.kabum.com.br/produto/684007/pc-gamer-completo");
  });
  it("usa a oferta relâmpago vigente e guarda o preço sem ela como preço 'de'", () => {
    const now = Math.floor(Date.now() / 1000);
    const it = { ...kabumBase, attributes: { ...kabumBase.attributes, offer: { price: 3711.75, price_with_discount: 3154.99, starts_at: now - 60, ends_at: now + 3600, quantity_available: 2, name: "X" } } };
    const o = mapKabumItem(it, "pc")!;
    expect(o.price).toBe(3154.99);
    expect(o.listPrice).toBe(4368.42);
    expect(o.stockQty).toBe(2);
  });
  it("classifica categoria pelo menu e descarta categoria errada", () => {
    expect(mapKabumItem({ ...kabumBase, attributes: { ...kabumBase.attributes, menu: "Hardware/Kit Hardware/Kit Upgrade" } }, "kit")?.categoryHint).toBe("kit");
    expect(mapKabumItem({ ...kabumBase, attributes: { ...kabumBase.attributes, menu: "Computadores/Notebooks" } }, "pc")).toBeNull();
  });
  it("vendedor pessoa física e item de mostruário", () => {
    const o = mapKabumItem({ ...kabumBase, attributes: { ...kabumBase.attributes, is_openbox: true, marketplace: { seller_name: "Fulano", state: "MG", seller_sale_pj: false } } }, "pc")!;
    expect(o.sellerType).toBe("pessoa-fisica");
    expect(o.condition).toBe("mostruario");
  });
});

const mlBase: MlItem = {
  id: "MLB123", title: "Pc Gamer Usado Ryzen 5 5600 Rtx 3060 16gb Ssd 1tb", price: 3200, original_price: null,
  permalink: "https://produto.mercadolivre.com.br/MLB-123", thumbnail: "http://http2.mlstatic.com/D_123-I.jpg",
  available_quantity: 1, condition: "used",
  shipping: { free_shipping: false, mode: "me2", logistic_type: "cross_docking", local_pick_up: true },
  seller: { id: 1, nickname: "VENDEDOR", seller_reputation: { transactions: { ratings: { positive: 0.97 }, total: 340 } } },
  address: { state_name: "São Paulo" },
};

describe("conector Mercado Livre (formato da API oficial)", () => {
  it("usado com Mercado Envios e retirada", () => {
    const o = mapMlItem(mlBase, "pc");
    expect(o.condition).toBe("usado");
    expect(o.shipAvailable).toBe(true);
    expect(o.shipScope).toBe("nacional");
    expect(o.shipProgram).toBe("Mercado Envios");
    expect(o.pickup).toBe(true);
    expect(o.protection).toMatch(/Compra Garantida/);
    expect(o.sellerRating).toBeCloseTo(4.85, 2);
    expect(o.imageUrl).toBe("https://http2.mlstatic.com/D_123-O.jpg");
  });
  it("modo 'not_specified' (combinar com o vendedor) não conta como envio confirmado", () => {
    const o = mapMlItem({ ...mlBase, shipping: { mode: "not_specified", local_pick_up: true } }, "pc");
    expect(o.shipAvailable).toBeNull();
    expect(o.shipScope).toBeNull();
    expect(o.pickup).toBe(true);
  });
  it("Full é identificado", () => {
    expect(mapMlItem({ ...mlBase, shipping: { mode: "me2", logistic_type: "fulfillment" } }, "pc").shipProgram).toBe("Mercado Envios Full");
  });
});

describe("feed de classificados (OLX/Enjoei/grupos autorizados)", () => {
  const csv = [
    "id,title,link,price,availability,condition,shipping_available,shipping_scope,pickup,protection,seller_type,location",
    "A1,PC Gamer usado i5 10400F GTX 1660 16gb SSD 480,https://x.example/a1,1450,in stock,used,sim,nacional,sim,Garantia OLX,pessoa-fisica,RJ",
    "A2,Monitor 24 Full HD 75hz usado,https://x.example/a2,190,in stock,used,,,sim,,pessoa-fisica,SP",
  ].join("\n");
  const [a1, a2] = parseFeed(csv, { store: "OLX (feed autorizado)", url: "file:///x", kind: "classificados" });
  it("lê envio, retirada, proteção, tipo de vendedor e local", () => {
    expect(a1).toMatchObject({ shipAvailable: true, shipScope: "nacional", pickup: true, protection: "Garantia OLX", sellerType: "pessoa-fisica", sellerLocation: "RJ", condition: "usado" });
  });
  it("nunca presume envio quando o feed não informa", () => {
    expect(a2.shipAvailable).toBeNull();
    expect(a2.pickup).toBe(true);
    expect(a2.condition).toBe("usado");
  });
  it("parseBool", () => {
    expect(parseBool("Sim")).toBe(true);
    expect(parseBool("não")).toBe(false);
    expect(parseBool("")).toBeNull();
  });
});

describe("plataformas sem integração autorizada", () => {
  for (const c of [olx, facebook, enjoei]) {
    it(`${c.name}: nunca aparece como funcional`, async () => {
      expect(c.status().state).toBe("unavailable");
      expect(c.status().configured).toBe(false);
      expect(c.evidence).toMatch(/2026/);
      await expect(c.search({ category: "pc", query: "", page: 1, pageSize: 10 })).rejects.toThrow(/autorizada/);
    });
  }
  it("ficam fora das buscas ativas e na ordem de prioridade", () => {
    const active = activeConnectors().map((c) => c.id);
    expect(active).not.toContain("olx");
    expect(active).not.toContain("facebook");
    expect(active).not.toContain("enjoei");
    expect(CONNECTORS.slice(0, 3).map((c) => c.id)).toEqual(["olx", "mercadolivre", "facebook"]);
  });
});

describe("kits de hardware", () => {
  it("título real de kit sem memória", () => {
    const s = parseSpecs("Kit Upgrade I5 3470/ Placa H61 S/ Memória Ram", null, null);
    expect(s.category).toBe("kit");
    expect(s.pc?.cpu?.model).toBe("Core i5-3470");
    expect(s.pc?.motherboard?.chipset).toBe("H61");
    expect(s.pc?.ramGb).toBeNull();
    expect(s.missing).toContain("memória (não inclusa)");
  });
  it("kit completo", () => {
    const s = parseSpecs("Kit Upgrade Intel I3 Segunda + Placa Mãe H61 + RAM 4GB DDR3 + Cooler", null, null);
    expect(s.category).toBe("kit");
    expect(s.pc?.ramGb).toBe(4);
    expect(s.pc?.ramType).toBe("DDR3");
  });
  it("PC completo não vira kit", () => {
    expect(parseSpecs("Kit PC Gamer Completo Ryzen 5 + Monitor", null, null).category).not.toBe("kit");
  });
});
