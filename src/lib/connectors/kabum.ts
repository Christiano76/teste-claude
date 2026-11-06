/**
 * KaBuM! — usa o endpoint JSON público de catálogo consumido pelo próprio site
 * (servicespub.prod.api.aws.grupokabum.com.br). Não há API oficial documentada:
 * a coleta é feita com baixa frequência, intervalo mínimo entre requisições e
 * identificação do robô no User-Agent. Pode ser desativada com KABUM_ENABLED=false.
 */
import { config } from "../config";
import { stripHtml } from "../hardware/specs";
import type { Category, RawOffer } from "../types";
import { fetchJson } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

const BASE = "https://servicespub.prod.api.aws.grupokabum.com.br/catalog/v2";

interface KabumOfferBlock {
  price: number;
  price_with_discount: number;
  starts_at: number;
  ends_at: number;
  quantity_available: number;
  name: string;
}

interface KabumAttrs {
  title: string;
  menu: string;
  price: number;
  old_price: number;
  price_with_discount: number;
  offer: KabumOfferBlock | null;
  available: boolean;
  stock: number;
  warranty: string;
  has_free_shipping: boolean;
  is_marketplace: boolean;
  is_openbox: boolean;
  marketplace?: { seller_name?: string; state?: string } | null;
  manufacturer?: { name?: string } | null;
  images?: string[];
  photos?: { g?: string[]; m?: string[] };
  product_link: string;
  score_of_ratings?: number;
  number_of_ratings?: number;
  html?: string;
  description?: string;
}

interface KabumItem {
  id: number;
  attributes: KabumAttrs;
}

function categoryOf(menu: string): Category | null {
  const m = menu.toLowerCase();
  if (m.includes("/monitores")) return "monitor";
  if (m.startsWith("computadores/pc") || m.includes("/pc gamer") || m.includes("computadores/computadores")) return "pc";
  return null;
}

function mapItem(it: KabumItem, wanted: Category): RawOffer | null {
  const a = it.attributes;
  const cat = categoryOf(a.menu ?? "");
  if (cat !== wanted) return null;
  const now = Date.now() / 1000;
  const flash = a.offer && a.offer.starts_at <= now && now <= a.offer.ends_at ? a.offer : null;
  const cash = flash?.price_with_discount ?? a.price_with_discount ?? a.price;
  const installments = flash?.price ?? a.price;
  // preço "de": o preço sem a oferta relâmpago, ou o old_price informado
  const list = flash ? a.price_with_discount : a.old_price > 0 ? a.old_price : null;
  const base = emptyOffer({
    source: "kabum",
    externalId: String(it.id),
    title: a.title.trim(),
    url: `https://www.kabum.com.br/produto/${it.id}/${a.product_link}`,
    price: cash,
    storeName: "KaBuM!",
  });
  return {
    ...base,
    imageUrl: a.images?.[0] ?? a.photos?.g?.[0] ?? a.photos?.m?.[0] ?? null,
    installmentPrice: installments && installments > cash ? installments : null,
    listPrice: list && list > cash ? list : null,
    available: a.available,
    stockQty: flash ? Math.min(flash.quantity_available, a.stock ?? Infinity) : a.stock ?? null,
    sellerName: a.is_marketplace ? a.marketplace?.seller_name ?? null : "KaBuM!",
    isMarketplace: a.is_marketplace,
    productRating: a.number_of_ratings ? a.score_of_ratings ?? null : null,
    productRatingCount: a.number_of_ratings ?? null,
    warrantyText: a.warranty || null,
    freeShipping: a.has_free_shipping,
    origin: "BR",
    taxesIncluded: true,
    condition: a.is_openbox ? "refurbished" : "new",
    brand: a.manufacturer?.name && a.manufacturer.name !== "-" ? a.manufacturer.name : null,
    categoryHint: cat,
    sellerLocation: a.marketplace?.state ?? null,
  };
}

export const kabum: Connector = {
  id: "kabum",
  name: "KaBuM! (catálogo público)",
  stores: ["KaBuM!"],
  kind: "public-json",
  status() {
    if (!config.connectors.kabum.enabled) return { configured: false, state: "disabled", message: "Desativado por KABUM_ENABLED=false.", requires: [], docsUrl: "https://www.kabum.com.br" };
    return {
      configured: true,
      state: "ok",
      message: "Funcionando sem credenciais (endpoint JSON público do catálogo). Frete por CEP não é exposto — mostramos apenas a flag de frete grátis.",
      requires: [],
      docsUrl: "https://www.kabum.com.br",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const q = defaultQuery(p.category, p.query);
    const url = `${BASE}/products?query=${encodeURIComponent(q)}&page_size=${p.pageSize}&page_number=${p.page}&sort=most_searched`;
    const d = await fetchJson<{ data: KabumItem[]; meta: { total_pages_count: number; total_items_count: number } }>(url, { minIntervalMs: 1200 });
    const offers = d.data.map((it) => mapItem(it, p.category)).filter((x): x is RawOffer => !!x);
    return { offers, hasMore: p.page < (d.meta?.total_pages_count ?? 0), totalAvailable: d.meta?.total_items_count };
  },
  async details(externalId: string) {
    const d = await fetchJson<KabumItem>(`${BASE}/products/${encodeURIComponent(externalId)}`, { minIntervalMs: 1200 });
    const a = d.attributes;
    const text = [a.html, a.description].filter(Boolean).map((h) => stripHtml(h!)).join("\n");
    return { specsText: text.slice(0, 8000) || null, warrantyText: a.warranty || null };
  },
};
