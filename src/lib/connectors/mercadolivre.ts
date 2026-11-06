/**
 * Mercado Livre — API oficial (developers.mercadolivre.com.br).
 * Desde 2025 a busca /sites/MLB/search exige access token OAuth.
 * Configure ML_ACCESS_TOKEN, ou ML_CLIENT_ID + ML_CLIENT_SECRET (+ ML_REFRESH_TOKEN)
 * para o token ser obtido/renovado automaticamente.
 */
import { config } from "../config";
import type { RawOffer } from "../types";
import { HttpError, fetchJson, fetchWithPolicy } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams, type ShippingQuote } from "./types";

const API = "https://api.mercadolibre.com";
let token: { value: string; exp: number } | null = null;

async function getToken(): Promise<string | null> {
  const c = config.connectors.mercadolivre;
  if (c.accessToken) return c.accessToken;
  if (token && token.exp > Date.now() + 60_000) return token.value;
  if (!c.clientId || !c.clientSecret) return null;
  const body = new URLSearchParams(
    c.refreshToken
      ? { grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: c.refreshToken }
      : { grant_type: "client_credentials", client_id: c.clientId, client_secret: c.clientSecret },
  );
  const res = await fetchWithPolicy(`${API}/oauth/token`, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  if (!res.ok) throw new HttpError(res.status, `${API}/oauth/token`, await res.text());
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.value;
}

interface MlItem {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  permalink: string;
  thumbnail: string;
  available_quantity?: number;
  condition: string;
  shipping?: { free_shipping?: boolean; logistic_type?: string };
  seller?: { id: number; nickname?: string; seller_reputation?: { level_id?: string; power_seller_status?: string | null; transactions?: { ratings?: { positive: number }; total?: number } } };
  attributes?: { id: string; value_name: string | null }[];
  address?: { state_name?: string };
  international_delivery_mode?: string;
  tags?: string[];
}

function attr(it: MlItem, id: string): string | null {
  return it.attributes?.find((a) => a.id === id)?.value_name ?? null;
}

function mapItem(it: MlItem, cat: "pc" | "monitor"): RawOffer {
  const rep = it.seller?.seller_reputation;
  const positive = rep?.transactions?.ratings?.positive;
  const intl = it.international_delivery_mode && it.international_delivery_mode !== "none" || it.tags?.includes("cbt_item");
  return {
    ...emptyOffer({ source: "mercadolivre", externalId: it.id, title: it.title, url: it.permalink, price: it.price, storeName: "Mercado Livre" }),
    imageUrl: it.thumbnail?.replace(/^http:/, "https:").replace(/-I\.jpg$/, "-O.jpg") ?? null,
    listPrice: it.original_price && it.original_price > it.price ? it.original_price : null,
    available: (it.available_quantity ?? 1) > 0,
    stockQty: it.available_quantity ?? null,
    sellerName: it.seller?.nickname ?? null,
    isMarketplace: true,
    sellerRating: positive != null ? Math.round(positive * 5 * 100) / 100 : null,
    sellerRatingCount: rep?.transactions?.total ?? null,
    freeShipping: it.shipping?.free_shipping ?? null,
    origin: intl ? "INTL" : "BR",
    taxesIncluded: intl ? null : true,
    condition: it.condition === "new" ? "new" : it.condition === "used" ? "used" : it.condition === "refurbished" ? "refurbished" : null,
    brand: attr(it, "BRAND"),
    categoryHint: cat,
    sellerLocation: it.address?.state_name ?? null,
    specsText: it.attributes?.map((a) => `${a.id}: ${a.value_name ?? ""}`).join("\n") ?? null,
  };
}

export const mercadolivre: Connector = {
  id: "mercadolivre",
  name: "Mercado Livre (API oficial)",
  stores: ["Mercado Livre"],
  kind: "official-api",
  status() {
    const c = config.connectors.mercadolivre;
    const configured = !!(c.accessToken || (c.clientId && c.clientSecret));
    return {
      configured,
      state: configured ? "unverified" : "needs-credentials",
      message: configured
        ? "Credenciais configuradas. Estado real aparece no último resultado de coleta."
        : "A busca da API oficial retorna 403 sem token OAuth (testado). Crie um app em developers.mercadolivre.com.br.",
      requires: ["ML_ACCESS_TOKEN ou ML_CLIENT_ID + ML_CLIENT_SECRET (+ ML_REFRESH_TOKEN)"],
      docsUrl: "https://developers.mercadolivre.com.br/pt_br/itens-e-buscas",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const t = await getToken();
    if (!t) throw new Error("Mercado Livre: sem credenciais (ML_ACCESS_TOKEN).");
    const q = defaultQuery(p.category, p.query);
    const limit = Math.min(50, p.pageSize);
    const offset = (p.page - 1) * limit;
    const url = `${API}/sites/MLB/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
    const d = await fetchJson<{ results: MlItem[]; paging: { total: number } }>(url, { headers: { Authorization: `Bearer ${t}` } });
    return { offers: d.results.map((r) => mapItem(r, p.category)), hasMore: offset + limit < Math.min(d.paging.total, 1000), totalAvailable: d.paging.total };
  },
  async shipping(externalId: string, cep: string): Promise<ShippingQuote | null> {
    const t = await getToken();
    if (!t) return null;
    const d = await fetchJson<{ options?: { cost: number; estimated_delivery_time?: { date?: string; shipping?: number } }[] }>(
      `${API}/items/${encodeURIComponent(externalId)}/shipping_options?zip_code=${cep}`,
      { headers: { Authorization: `Bearer ${t}` } },
    );
    const opt = d.options?.sort((a, b) => a.cost - b.cost)[0];
    if (!opt) return null;
    let delivery = null;
    const date = opt.estimated_delivery_time?.date;
    if (date) {
      const days = Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400_000));
      delivery = { minDays: days, maxDays: days, source: "api-mercadolivre" };
    }
    return { cost: opt.cost, delivery };
  },
};
