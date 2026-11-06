/**
 * Amazon Brasil — Product Advertising API 5.0 (programa de Associados).
 * Requer conta de Associado aprovada com vendas qualificadas.
 * Observação: a Amazon vem migrando associados para uma nova API ("Creators API");
 * se a PA-API 5 for descontinuada para sua conta, este conector deve ser adaptado.
 */
import { createHash, createHmac } from "crypto";
import { config } from "../config";
import type { RawOffer } from "../types";
import { HttpError, fetchWithPolicy } from "../util/http";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const hmac = (k: Buffer | string, s: string) => createHmac("sha256", k).update(s, "utf8").digest();

/** Assinatura AWS Signature Version 4 (serviço ProductAdvertisingAPI). */
export function signPaapi(opts: { host: string; region: string; path: string; target: string; body: string; accessKey: string; secretKey: string; now?: Date }) {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const service = "ProductAdvertisingAPI";
  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=utf-8",
    host: opts.host,
    "x-amz-date": amzDate,
    "x-amz-target": opts.target,
  };
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((k) => `${k}:${headers[k]}\n`).join("");
  const canonicalRequest = ["POST", opts.path, "", canonicalHeaders, signedHeaders, sha256(opts.body)].join("\n");
  const scope = `${date}/${opts.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kDate = hmac(`AWS4${opts.secretKey}`, date);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign, "utf8").digest("hex");
  return {
    ...headers,
    Authorization: `AWS4-HMAC-SHA256 Credential=${opts.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

interface PaItem {
  ASIN: string;
  DetailPageURL: string;
  Images?: { Primary?: { Large?: { URL: string } } };
  ItemInfo?: { Title?: { DisplayValue: string }; ByLineInfo?: { Brand?: { DisplayValue: string } }; Features?: { DisplayValues: string[] } };
  Offers?: {
    Listings?: {
      Price?: { Amount: number; Currency: string };
      SavingBasis?: { Amount: number };
      Availability?: { Type?: string; Message?: string };
      DeliveryInfo?: { IsAmazonFulfilled?: boolean; IsFreeShippingEligible?: boolean; IsPrimeEligible?: boolean };
      MerchantInfo?: { Name?: string; FeedbackRating?: number; FeedbackCount?: number };
      Condition?: { Value?: string };
    }[];
  };
}

export const amazon: Connector = {
  id: "amazon",
  name: "Amazon Brasil (PA-API 5)",
  stores: ["Amazon Brasil"],
  kind: "affiliate-api",
  status() {
    const c = config.connectors.amazon;
    const configured = !!(c.accessKey && c.secretKey && c.partnerTag);
    return {
      configured,
      state: configured ? "unverified" : "needs-credentials",
      message: configured ? "Credenciais configuradas; resultado real aparece no histórico de coletas." : "Requer conta de Associado Amazon com acesso à PA-API.",
      requires: ["AMAZON_PAAPI_ACCESS_KEY", "AMAZON_PAAPI_SECRET_KEY", "AMAZON_PAAPI_PARTNER_TAG"],
      docsUrl: "https://webservices.amazon.com/paapi5/documentation/",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const c = config.connectors.amazon;
    if (!c.accessKey || !c.secretKey || !c.partnerTag) throw new Error("Amazon: sem credenciais PA-API.");
    const path = "/paapi5/searchitems";
    const body = JSON.stringify({
      Keywords: defaultQuery(p.category, p.query),
      SearchIndex: "Computers",
      ItemCount: 10,
      ItemPage: p.page,
      PartnerTag: c.partnerTag,
      PartnerType: "Associates",
      Marketplace: "www.amazon.com.br",
      Resources: [
        "Images.Primary.Large", "ItemInfo.Title", "ItemInfo.ByLineInfo", "ItemInfo.Features",
        "Offers.Listings.Price", "Offers.Listings.SavingBasis", "Offers.Listings.Availability.Type",
        "Offers.Listings.Availability.Message", "Offers.Listings.DeliveryInfo.IsPrimeEligible",
        "Offers.Listings.DeliveryInfo.IsFreeShippingEligible", "Offers.Listings.DeliveryInfo.IsAmazonFulfilled",
        "Offers.Listings.MerchantInfo", "Offers.Listings.Condition",
      ],
    });
    const headers = signPaapi({ host: c.host, region: c.region, path, target: "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems", body, accessKey: c.accessKey, secretKey: c.secretKey });
    const res = await fetchWithPolicy(`https://${c.host}${path}`, { method: "POST", body, headers, minIntervalMs: 1100 });
    if (!res.ok) throw new HttpError(res.status, `https://${c.host}${path}`, await res.text());
    const d = (await res.json()) as { SearchResult?: { Items?: PaItem[]; TotalResultCount?: number } };
    const offers: RawOffer[] = [];
    for (const it of d.SearchResult?.Items ?? []) {
      const l = it.Offers?.Listings?.[0];
      if (!l?.Price) continue;
      const merchant = l.MerchantInfo?.Name ?? null;
      offers.push({
        ...emptyOffer({ source: "amazon", externalId: it.ASIN, title: it.ItemInfo?.Title?.DisplayValue ?? it.ASIN, url: it.DetailPageURL, price: l.Price.Amount, storeName: "Amazon Brasil" }),
        imageUrl: it.Images?.Primary?.Large?.URL ?? null,
        listPrice: l.SavingBasis?.Amount ?? null,
        available: l.Availability?.Type ? l.Availability.Type === "Now" : null,
        sellerName: merchant,
        isMarketplace: merchant ? !/amazon/i.test(merchant) : null,
        sellerRating: l.MerchantInfo?.FeedbackRating ?? null,
        sellerRatingCount: l.MerchantInfo?.FeedbackCount ?? null,
        freeShipping: l.DeliveryInfo?.IsFreeShippingEligible ?? null,
        origin: "BR",
        taxesIncluded: true,
        condition: l.Condition?.Value === "New" ? "new" : l.Condition?.Value === "Used" ? "used" : null,
        brand: it.ItemInfo?.ByLineInfo?.Brand?.DisplayValue ?? null,
        categoryHint: p.category,
        specsText: it.ItemInfo?.Features?.DisplayValues?.join("\n") ?? null,
      });
    }
    return { offers, hasMore: p.page < 10 && (d.SearchResult?.Items?.length ?? 0) === 10, totalAvailable: d.SearchResult?.TotalResultCount };
  },
};
