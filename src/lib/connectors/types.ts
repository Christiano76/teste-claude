import type { Category, DeliveryEstimate, RawOffer } from "../types";

export interface SearchParams {
  category: Category;
  /** Texto livre do usuário (pode ser vazio: usa a busca padrão da categoria). */
  query: string;
  page: number; // 1-based
  pageSize: number;
  /** Orçamento máximo (ajuda as fontes de busca a priorizar anúncios baratos). */
  maxPrice?: number;
  /** UF do comprador (ex.: OLX regional). */
  uf?: string | null;
}

export interface SearchPage {
  offers: RawOffer[];
  hasMore: boolean;
  totalAvailable?: number;
}

export interface ConnectorStatus {
  configured: boolean;
  /** "ok" = testado e funcionando; "needs-credentials"; "blocked"; "disabled" */
  /** unavailable = não existe meio autorizado de busca para terceiros (nunca exibido como funcional). */
  state: "ok" | "needs-credentials" | "blocked" | "disabled" | "unverified" | "unavailable";
  message: string;
  requires: string[];
  docsUrl: string;
}

export interface ShippingQuote {
  cost: number | null;
  delivery: DeliveryEstimate | null;
}

export interface Connector {
  id: string;
  name: string;
  /** Lojas cobertas por este conector. */
  stores: string[];
  kind: "public-json" | "official-api" | "affiliate-api" | "feed" | "classificados" | "search-index";
  /** Evidência verificada do status (data e o que foi testado). */
  evidence?: string;
  status(): ConnectorStatus;
  search(p: SearchParams): Promise<SearchPage>;
  /** Busca detalhes (ficha técnica) de um item. */
  details?(externalId: string): Promise<Partial<RawOffer> | null>;
  /** Frete/prazo para um CEP, quando a fonte oferece. */
  shipping?(externalId: string, cep: string): Promise<ShippingQuote | null>;
}

export function defaultQuery(category: Category, q: string): string {
  const t = q.trim();
  if (category === "peca") return t || "placa de video";
  if (category === "kit") return t ? `kit upgrade ${t}` : "kit upgrade";
  if (category === "monitor") return t ? (/monitor/i.test(t) ? t : `monitor ${t}`) : "monitor gamer";
  return t ? (/\b(pc|computador|workstation|desktop)\b/i.test(t) ? t : `pc gamer ${t}`) : "pc gamer";
}

export function emptyOffer(partial: Pick<RawOffer, "source" | "externalId" | "title" | "url" | "price" | "storeName">): RawOffer {
  return {
    imageUrl: null, installmentPrice: null, listPrice: null, currency: "BRL", available: null, stockQty: null,
    sellerName: null, isMarketplace: null, sellerRating: null, sellerRatingCount: null, productRating: null,
    productRatingCount: null, warrantyText: null, freeShipping: null, shippingCost: null, delivery: null, origin: null,
    taxesIncluded: null, condition: null, sellerType: null, pickup: null, shipAvailable: null, shipScope: null, shipProgram: null, protection: null, verification: "api", priceSource: null, indexedAt: null, platform: null, brand: null, categoryHint: null, specsText: null, sellerLocation: null,
    ...partial,
  };
}
