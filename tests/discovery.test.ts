/**
 * Descoberta via Brave Search: detectores de anúncio individual por plataforma e mapeamento
 * dos resultados. As URLs e títulos são de resultados reais da Brave (08/11/2026).
 */
import { describe, expect, it } from "vitest";
import { buildQueries, mapBraveResult, ufFromCep } from "@/lib/discovery/connectors";
import { looksLikeProductPage, PLATFORMS } from "@/lib/discovery/platforms";
import { classifyPart } from "@/lib/hardware/parts";
import { usageProfile } from "@/lib/hardware/performance";
import { parseSpecs } from "@/lib/hardware/specs";

const P = (id: string) => PLATFORMS.find((p) => p.id === id)!;
const item = (id: string, url: string) => P(id).isItem(new URL(url));

describe("detectores de anúncio individual (não listagens)", () => {
  it("OLX: anúncio regional sim; categoria/busca não", () => {
    expect(item("olx", "https://df.olx.com.br/distrito-federal-e-regiao/informatica/computadores-e-desktops/pc-i5-completo-top-1458508492")).toBe(true);
    expect(item("olx", "https://www.olx.com.br/informatica/computadores-e-desktops/pc-gamer")).toBe(false);
    expect(P("olx").itemId(new URL("https://df.olx.com.br/x/pc-i5-completo-top-1458508492"))).toBe("1458508492");
  });
  it("Mercado Livre: produto sim; lista não", () => {
    expect(item("mercadolivre", "https://produto.mercadolivre.com.br/MLB-3618499172-pc-gamer-completo-intel-i5-16gb-ram-ssd-240gb-video-1gb-_JM")).toBe(true);
    expect(item("mercadolivre", "https://lista.mercadolivre.com.br/computador-i5-usado")).toBe(false);
  });
  it("Amazon /dp/, Shopee -i., Terabyte /produto/, eBay /itm/, Carrefour /produto/", () => {
    expect(item("amazon", "https://www.amazon.com.br/Gamer-Completo-Monitor-Strong-Tech/dp/B0FJYNZTXB")).toBe(true);
    expect(item("amazon", "https://www.amazon.com.br/pc-gamer/s?k=pc+gamer")).toBe(false);
    expect(item("shopee", "https://shopee.com.br/Monitor-24-Polegadas-HQ-24HQ-LED-75Hz-HDMI-VGA-FullHD-Outlet-i.344390826.21199663571")).toBe(true);
    expect(item("shopee", "https://shopee.com.br/list/Monitor/24%20Polegadas")).toBe(false);
    expect(item("terabyte", "https://www.terabyteshop.com.br/produto/44331/pc-gamer-captain-amd-ryzen-5-5500f")).toBe(true);
    expect(item("terabyte", "https://www.terabyteshop.com.br/pc-gamer/full-custom")).toBe(false);
    expect(item("ebay", "https://www.ebay.com/itm/197098273491")).toBe(true);
    expect(item("ebay", "https://br.ebay.com/b/Dell-Optiplex-Desktops/179/bn_7114050175")).toBe(false);
    expect(item("carrefour", "https://www.carrefour.com.br/produto/computador-completo-intel-core-i5-4gb-hd-1tb-331838532")).toBe(true);
    expect(item("carrefour", "https://www.carrefour.com.br/categoria/informatica/computador")).toBe(false);
  });
  it("Pichau/Enjoei: produto × categoria/busca", () => {
    expect(item("pichau", "https://www.pichau.com.br/pc-home-completo-pichau-hd701-intel-core-i5-8gb-ddr3-ssd-120gb-monitor-58220")).toBe(true);
    expect(item("pichau", "https://www.pichau.com.br/computadores/pichau-gamer")).toBe(false);
    expect(item("enjoei", "https://www.enjoei.com.br/pc-gamer/s?q=pc+gamer")).toBe(false);
  });
  it("loja desconhecida: só com preço estruturado e sem cara de busca/categoria", () => {
    expect(looksLikeProductPage(new URL("https://reciclashop.com.br/produto/desktop-dell-optiplex-3020-i5"), true)).toBe(true);
    expect(looksLikeProductPage(new URL("https://reciclashop.com.br/categoria-produto/computadores-usados/"), true)).toBe(true);
    expect(looksLikeProductPage(new URL("https://loja.example/busca?q=pc"), true)).toBe(false);
    expect(looksLikeProductPage(new URL("https://loja.example/produto/x"), false)).toBe(false);
  });
});

describe("mapeamento de resultado da Brave", () => {
  const olx = {
    title: "PC i5 completo top - Computadores e Desktops - Park Way, Brasília 1458508492 | OLX",
    url: "https://df.olx.com.br/distrito-federal-e-regiao/informatica/computadores-e-desktops/pc-i5-completo-top-1458508492",
    description: "PC i5 completo, 8GB de RAM, SSD 240, monitor 19, teclado e mouse. Usado, funcionando.",
    age: "December 1, 2025",
    product: { price: "850.0" },
  };
  it("OLX com preço → oferta não verificada, localizada, sem envio presumido", () => {
    const m = mapBraveResult(olx, P("olx"));
    expect(m.offer).not.toBeNull();
    const o = m.offer!;
    expect(o.price).toBe(850);
    expect(o.title).toBe("PC i5 completo top");
    expect(o.sellerLocation).toBe("Brasília/DF");
    expect(o.verification).toBe("indice-busca");
    expect(o.available).toBeNull();
    expect(o.shipAvailable).toBeNull();
    expect(o.condition).toBe("usado");
    expect(o.categoryHint).toBe("pc");
    expect(o.priceSource).toMatch(/indexad/);
  });
  it("sem preço → vira 'anúncio encontrado' (listing), não oferta", () => {
    const m = mapBraveResult({ ...olx, product: undefined, description: "PC completo, chama no chat" }, P("olx"));
    expect(m.offer).toBeNull();
    expect(m.listing?.title).toBe("PC i5 completo top");
  });
  it("página de listagem é ignorada", () => {
    expect(mapBraveResult({ ...olx, url: "https://www.olx.com.br/informatica/computadores-e-desktops/pc-gamer" }, P("olx"))).toEqual({ offer: null, listing: null });
  });
  it("preço 'sob consulta' (99999,90) é descartado", () => {
    const m = mapBraveResult({ title: "Monitor Gamer 27 QHD - GK Infostore", url: "https://www.gkinfostore.com.br/monitor-gamer-27-qhd-170hz-ips", product: { price: "99999.9" } }, P("gkinfostore"));
    expect(m.offer).toBeNull();
  });
  it("um único valor em R$ no trecho vira preço (marcado como do trecho)", () => {
    const m = mapBraveResult({ title: "Monitor 24 usado | MercadoLivre", url: "https://produto.mercadolivre.com.br/MLB-123456789-monitor-24", description: "Monitor 24 polegadas usado por R$ 320,00 em ótimo estado" }, P("mercadolivre"));
    expect(m.offer?.price).toBe(320);
    expect(m.offer?.priceSource).toMatch(/trecho/);
    expect(m.offer?.categoryHint).toBe("monitor");
  });
});

describe("consultas e CEP", () => {
  it("nomes alternativos e termo do usuário", () => {
    const q = buildQueries("pc", "", 500, 4);
    expect(q[0]).toBe("computador completo");
    expect(q[1]).toMatch(/barato/);
    expect(buildQueries("pc", "i5", undefined, 2)).toEqual(["computador i5", "computador i5 usado"]);
  });
  it("CEP 71572811 → DF", () => {
    expect(ufFromCep("71572811")).toBe("df");
    expect(ufFromCep("01001000")).toBe("sp");
  });
});

describe("peças avulsas e uso", () => {
  it("classifica peças e nunca confunde com PC", () => {
    expect(classifyPart("Placa de Vídeo ASUS DUAL RTX 5060 O8G NVIDIA GeForce, 8GB GDDR7")?.kind).toBe("gpu");
    expect(classifyPart("Placa de Vídeo ASUS DUAL RTX 5060 O8G NVIDIA GeForce, 8GB GDDR7")?.index).toBe(122);
    expect(classifyPart("Processador AMD Ryzen 5 5600, 3.5GHz, AM4")?.model).toBe("Ryzen 5 5600");
    expect(classifyPart("Memória Kingston Fury Beast, 16GB (2x8GB), 3200MHz, DDR4")?.capacity).toBe(16);
    expect(classifyPart("SSD Kingston NV2 1TB M.2 NVMe")?.capacity).toBe(1000);
    expect(classifyPart("PC Gamer Ryzen 5 5600 RTX 4060")).toBeNull();
    expect(parseSpecs("Placa de Vídeo Galax GTX 1650 4GB", null, null).category).toBe("peca");
    expect(parseSpecs("Computador completo i5 GTX 1650", null, null).category).toBe("pc");
  });
  it("PC sem processador e notebook não são PC completo", async () => {
    const { isAccessory } = await import("@/lib/hardware/specs");
    expect(isAccessory("Computador Core sem processador, HD e memória")).toBe(true);
    expect(isAccessory("Notebook barato positivo")).toBe(true);
    expect(isAccessory("Kit Upgrade I5 3470/ Placa H61 S/ Memória Ram")).toBe(false);
    expect(isAccessory("Computador completo i5 8gb")).toBe(false);
  });
  it("perfil de uso (estimativa)", () => {
    const office = usageProfile(parseSpecs("Computador Dell Optiplex i5-4590 8GB SSD 240", null, null).pc!);
    expect(office.find((u) => u.use === "Estudos e navegação")?.level).toBe("adequado");
    expect(office.find((u) => u.use === "Jogos exigentes")?.level).toBe("nao-recomendado");
    const gamer = usageProfile(parseSpecs("PC Gamer Ryzen 5 5600 RTX 4060 16GB SSD 1TB", null, null).pc!);
    expect(gamer.find((u) => u.use === "Jogos competitivos")?.level).toBe("adequado");
  });
});
