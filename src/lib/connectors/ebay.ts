/**
 * eBay — Browse API oficial (item_summary/search) com filtro de entrega para o Brasil.
 * Requer EBAY_CLIENT_ID e EBAY_CLIENT_SECRET (app em developer.ebay.com; token client_credentials).
 */
import { config } from "../config";
import { classifyCondition } from "../market/condition";
import type { RawOffer } from "../types";
import { HttpError, fetchJson, fetchWithPolicy } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

let token: { v: string; exp: number } | null = null;

async function appToken(): Promise<string | null> {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (token && token.exp > Date.now() + 60_000) return token.v;
  const res = await fetchWithPolicy("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "https://api.ebay.com/oauth/api_scope" }),
  });
  if (!res.ok) throw new HttpError(res.status, "https://api.ebay.com/identity/v1/oauth2/token", await res.text());
  const j = (await res.json()) as { access_token: string; expires_in: number };
  token = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return token.v;
}

interface EbayItem {
  itemId: string; title: string; itemWebUrl: string; condition?: string;
  price?: { value: string; currency: string };
  image?: { imageUrl: string };
  seller?: { username?: string; feedbackPercentage?: string; feedbackScore?: number };
  shippingOptions?: { shippingCost?: { value: string; currency: string }; shippingCostType?: string }[];
  itemLocation?: { country?: string };
}

export const ebay: Connector = {
  id: "ebay",
  name: "eBay (Browse API)",
  stores: ["eBay"],
  kind: "official-api",
  status() {
    const configured = !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
    return {
      configured,
      state: configured ? "unverified" : "needs-credentials",
      message: configured ? "Busca com filtro deliveryCountry:BR (entrega para o Brasil confirmada pela API)." : "Requer app no eBay Developers. Sem credenciais, anúncios do eBay aparecem só via Brave (entrega para o Brasil não verificada).",
      requires: ["EBAY_CLIENT_ID", "EBAY_CLIENT_SECRET"],
      docsUrl: "https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const t = await appToken();
    if (!t) throw new Error("eBay: sem credenciais.");
    const q = defaultQuery(p.category, p.query).replace(/\bpc gamer\b/i, "gaming pc").replace(/\bcomputador\b/i, "desktop computer");
    const limit = 50, offset = (p.page - 1) * limit;
    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}&filter=${encodeURIComponent("deliveryCountry:BR")}`;
    const d = await fetchJson<{ itemSummaries?: EbayItem[]; total?: number }>(url, { headers: { Authorization: `Bearer ${t}`, "X-EBAY-C-MARKETPLACE-ID": "EBAY_US" } });
    const fx = config.importIcmsRate; void fx;
    const offers: RawOffer[] = (d.itemSummaries ?? []).flatMap((it) => {
      if (!it.price || it.price.currency !== "USD") return [];
      const ship = it.shippingOptions?.[0]?.shippingCost;
      return [{
        ...emptyOffer({ source: "ebay", externalId: it.itemId, title: it.title, url: it.itemWebUrl, price: Number(it.price.value), storeName: "eBay" }),
        currency: "USD" as const,
        imageUrl: it.image?.imageUrl ?? null,
        sellerName: it.seller?.username ?? null,
        isMarketplace: true,
        sellerRating: it.seller?.feedbackPercentage ? (Number(it.seller.feedbackPercentage) / 100) * 5 : null,
        sellerRatingCount: it.seller?.feedbackScore ?? null,
        // valor de frete do eBay vem em USD; convertido na análise de custo apenas se informado em BRL
        shippingCost: null,
        freeShipping: ship ? Number(ship.value) === 0 : null,
        shipAvailable: true, // filtro deliveryCountry:BR
        shipScope: "internacional" as const,
        origin: "INTL" as const,
        taxesIncluded: false,
        protection: "eBay Money Back Guarantee",
        condition: classifyCondition(it.title, null, it.condition ?? null),
        categoryHint: p.category,
        platform: "eBay",
      }];
    });
    return { offers, hasMore: offset + limit < Math.min(d.total ?? 0, 500), totalAvailable: d.total };
  },
};
