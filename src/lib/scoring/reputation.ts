import type { RawOffer } from "../types";

export interface StoreRow {
  slug: string;
  name: string;
  reputation: number | null;
  reputation_basis: string | null;
}

export function storeReputation(o: RawOffer, store: StoreRow | null): { score: number; label: string; basis: string } {
  const base = store?.reputation ?? 50;
  const baseBasis = store?.reputation != null ? `${store.name}: ${store.reputation_basis ?? "base curada"}` : "Loja sem histórico na base (descoberta automaticamente).";
  const thirdParty = o.isMarketplace && o.sellerName && store && o.sellerName.toLowerCase() !== store.name.toLowerCase();
  if (!thirdParty) return { score: base, label: labelOf(base), basis: baseBasis };

  let seller: number;
  let sellerBasis: string;
  if (o.sellerRating != null && (o.sellerRatingCount ?? 0) >= 20) {
    seller = Math.round((o.sellerRating / 5) * 100 * (o.sellerRatingCount! >= 500 ? 1 : 0.92));
    sellerBasis = `vendedor ${o.sellerName}: nota ${o.sellerRating.toFixed(1)}/5 em ${o.sellerRatingCount} avaliações`;
  } else if (o.sellerRating != null) {
    seller = 50;
    sellerBasis = `vendedor ${o.sellerName}: poucas avaliações`;
  } else {
    seller = 55;
    sellerBasis = `vendido por parceiro (${o.sellerName}) — reputação do vendedor não informada pela fonte`;
  }
  const score = Math.round(base * 0.4 + seller * 0.6);
  return { score, label: labelOf(score), basis: `${baseBasis}; ${sellerBasis}.` };
}

function labelOf(s: number): string {
  if (s >= 85) return "Muito confiável";
  if (s >= 72) return "Confiável";
  if (s >= 58) return "Regular";
  return "Atenção";
}

/** Meses de garantia contratual + legal informados. null = não informado. */
export function warrantyMonths(text: string | null): { months: number | null; label: string } {
  if (!text) return { months: null, label: "Garantia não informada (garantia legal de 90 dias pelo CDC)" };
  const t = text.toLowerCase();
  if (/sem garantia/.test(t)) return { months: 3, label: "Sem garantia contratual informada — vale a garantia legal de 90 dias (CDC)" };
  const m = t.match(/(\d{1,2})\s*(anos?|meses|m[eê]s)/);
  if (!m) return { months: null, label: text };
  const months = /ano/.test(m[2]) ? Number(m[1]) * 12 : Number(m[1]);
  return { months, label: `${months >= 12 && months % 12 === 0 ? `${months / 12} ano(s)` : `${months} meses`} de garantia` };
}
