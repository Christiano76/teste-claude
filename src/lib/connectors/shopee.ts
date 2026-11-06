/**
 * Shopee — Open API de Afiliados (GraphQL, affiliate.shopee.com.br).
 * Assinatura: SHA256(appId + timestamp + payload + secret).
 */
import { createHash } from "crypto";
import { config } from "../config";
import { classifyCondition } from "../market/condition";
import type { RawOffer } from "../types";
import { HttpError, fetchWithPolicy } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

const ENDPOINT = "https://open-api.affiliate.shopee.com.br/graphql";

export function shopeeAuthHeader(appId: string, secret: string, payload: string, ts = Math.floor(Date.now() / 1000)): string {
  const sig = createHash("sha256").update(`${appId}${ts}${payload}${secret}`).digest("hex");
  return `SHA256 Credential=${appId}, Timestamp=${ts}, Signature=${sig}`;
}

interface ShopeeNode {
  itemId: number;
  productName: string;
  priceMin: string;
  priceMax: string;
  offerLink: string;
  productLink: string;
  imageUrl: string;
  shopName: string;
  ratingStar: string;
  sales: number;
  shopType: number[];
}

export const shopee: Connector = {
  id: "shopee",
  name: "Shopee (API de Afiliados)",
  stores: ["Shopee"],
  kind: "affiliate-api",
  status() {
    const c = config.connectors.shopee;
    const configured = !!(c.appId && c.secret);
    return {
      configured,
      state: configured ? "unverified" : "needs-credentials",
      message: configured ? "Credenciais configuradas." : "Requer conta no Programa de Afiliados Shopee com acesso à Open API.",
      requires: ["SHOPEE_AFFILIATE_APP_ID", "SHOPEE_AFFILIATE_SECRET"],
      docsUrl: "https://affiliate.shopee.com.br/open_api",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const c = config.connectors.shopee;
    if (!c.appId || !c.secret) throw new Error("Shopee: sem credenciais.");
    const q = `{productOfferV2(keyword: ${JSON.stringify(defaultQuery(p.category, p.query))}, limit: ${Math.min(50, p.pageSize)}, page: ${p.page}, sortType: 2) { nodes { itemId productName priceMin priceMax offerLink productLink imageUrl shopName ratingStar sales shopType } pageInfo { hasNextPage } } }`;
    const payload = JSON.stringify({ query: q });
    const res = await fetchWithPolicy(ENDPOINT, { method: "POST", body: payload, headers: { "Content-Type": "application/json", Authorization: shopeeAuthHeader(c.appId, c.secret, payload) } });
    if (!res.ok) throw new HttpError(res.status, ENDPOINT, await res.text());
    const d = (await res.json()) as { data?: { productOfferV2?: { nodes: ShopeeNode[]; pageInfo: { hasNextPage: boolean } } }; errors?: { message: string }[] };
    if (d.errors?.length) throw new Error(`Shopee: ${d.errors[0].message}`);
    const offers: RawOffer[] = (d.data?.productOfferV2?.nodes ?? []).map((n) => ({
      ...emptyOffer({ source: "shopee", externalId: String(n.itemId), title: n.productName, url: n.offerLink || n.productLink, price: Number(n.priceMin), storeName: "Shopee" }),
      imageUrl: n.imageUrl,
      sellerName: n.shopName,
      isMarketplace: true,
      productRating: Number(n.ratingStar) || null,
      sellerType: n.shopType?.length ? ("profissional" as const) : null,
      condition: classifyCondition(n.productName, null, null),
      categoryHint: p.category,
    }));
    return { offers, hasMore: !!d.data?.productOfferV2?.pageInfo.hasNextPage };
  },
};
