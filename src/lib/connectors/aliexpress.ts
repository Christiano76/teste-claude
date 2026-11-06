/**
 * AliExpress — Affiliate API (portals.aliexpress.com, método aliexpress.affiliate.product.query).
 * Produtos internacionais: impostos de importação são estimados à parte.
 */
import { createHmac } from "crypto";
import { config } from "../config";
import type { RawOffer } from "../types";
import { fetchJson } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

export function signAliexpress(params: Record<string, string>, secret: string): string {
  const base = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secret).update(base, "utf8").digest("hex").toUpperCase();
}

interface AeProduct {
  product_id: number | string;
  product_title: string;
  target_sale_price?: string;
  target_original_price?: string;
  target_sale_price_currency?: string;
  promotion_link?: string;
  product_detail_url?: string;
  product_main_image_url?: string;
  evaluate_rate?: string; // "95.2%"
  shop_name?: string;
  lastest_volume?: number;
  ship_to_days?: string;
}

export const aliexpress: Connector = {
  id: "aliexpress",
  name: "AliExpress (Affiliate API)",
  stores: ["AliExpress"],
  kind: "affiliate-api",
  status() {
    const c = config.connectors.aliexpress;
    const configured = !!(c.appKey && c.appSecret);
    return {
      configured,
      state: configured ? "unverified" : "needs-credentials",
      message: configured ? "Credenciais configuradas." : "Requer cadastro no AliExpress Portals (afiliados) e app key/secret.",
      requires: ["ALIEXPRESS_APP_KEY", "ALIEXPRESS_APP_SECRET", "ALIEXPRESS_TRACKING_ID (opcional)"],
      docsUrl: "https://openservice.aliexpress.com/doc/api.htm",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const c = config.connectors.aliexpress;
    if (!c.appKey || !c.appSecret) throw new Error("AliExpress: sem credenciais.");
    const params: Record<string, string> = {
      method: "aliexpress.affiliate.product.query",
      app_key: c.appKey,
      sign_method: "sha256",
      timestamp: String(Date.now()),
      keywords: defaultQuery(p.category, p.query),
      target_currency: "BRL",
      target_language: "PT",
      ship_to_country: "BR",
      page_no: String(p.page),
      page_size: String(Math.min(50, p.pageSize)),
    };
    if (c.trackingId) params.tracking_id = c.trackingId;
    params.sign = signAliexpress(params, c.appSecret);
    const url = `https://api-sg.aliexpress.com/sync?${new URLSearchParams(params)}`;
    const d = await fetchJson<{ aliexpress_affiliate_product_query_response?: { resp_result?: { result?: { products?: { product?: AeProduct[] }; total_record_count?: number } } } }>(url);
    const result = d.aliexpress_affiliate_product_query_response?.resp_result?.result;
    const offers: RawOffer[] = (result?.products?.product ?? []).flatMap((it) => {
      const price = Number(it.target_sale_price);
      if (!price) return [];
      const days = it.ship_to_days ? Number(it.ship_to_days) : null;
      return [{
        ...emptyOffer({ source: "aliexpress", externalId: String(it.product_id), title: it.product_title, url: it.promotion_link ?? it.product_detail_url ?? `https://pt.aliexpress.com/item/${it.product_id}.html`, price, storeName: "AliExpress" }),
        imageUrl: it.product_main_image_url ?? null,
        listPrice: Number(it.target_original_price) > price ? Number(it.target_original_price) : null,
        sellerName: it.shop_name ?? null,
        isMarketplace: true,
        sellerRating: it.evaluate_rate ? (parseFloat(it.evaluate_rate) / 100) * 5 : null,
        origin: "INTL" as const,
        taxesIncluded: false,
        delivery: days ? { minDays: days, maxDays: days, source: "api-aliexpress" } : null,
        categoryHint: p.category,
      }];
    });
    return { offers, hasMore: (result?.total_record_count ?? 0) > p.page * p.pageSize, totalAvailable: result?.total_record_count };
  },
};
