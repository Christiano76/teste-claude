export function brl(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function scoreColor(s: number): string {
  if (s >= 90) return "var(--color-good)";
  if (s >= 75) return "var(--color-ok)";
  if (s >= 60) return "var(--color-mid)";
  return "var(--color-bad)";
}

export const VERDICT: Record<string, string> = {
  excelente: "Excelente oportunidade",
  "muito-bom": "Muito bom",
  razoavel: "Razoável",
  "pouco-recomendado": "Pouco recomendado",
};

export function deliveryText(o: { delivery: { minDays: number; maxDays: number } | null; origin: string | null }): string {
  if (o.delivery) return o.delivery.minDays === o.delivery.maxDays ? `até ${o.delivery.maxDays} dia(s)` : `${o.delivery.minDays}–${o.delivery.maxDays} dias`;
  return o.origin === "INTL" ? "internacional · prazo não verificado" : "prazo não verificado";
}
