/**
 * Estimativa de tributos de importação para pessoa física (remessa internacional,
 * programa Remessa Conforme). Regras federais vigentes desde ago/2024:
 *  - até US$ 50: Imposto de Importação de 20%;
 *  - de US$ 50,01 a US$ 3.000: 60%, com dedução de US$ 20.
 * ICMS estadual cobrado "por dentro" (alíquota configurável — 17% a 20% conforme o estado).
 * Valor tributável = produto + frete internacional.
 * É uma ESTIMATIVA e é exibida como tal.
 */
export interface ImportTaxResult {
  importTax: number; // BRL
  icms: number; // BRL
  notes: string[];
}

export function estimateImportTaxes(valueBrl: number, shippingBrl: number, usdRate: number, icmsRate: number): ImportTaxResult {
  const base = valueBrl + shippingBrl;
  const baseUsd = base / usdRate;
  let ii: number;
  const notes: string[] = [];
  if (baseUsd > 3000) {
    notes.push("Acima de US$ 3.000 a remessa não se enquadra no regime simplificado — tributação pode ser maior.");
    ii = base * 0.6;
  } else if (baseUsd <= 50) {
    ii = base * 0.2;
  } else {
    ii = Math.max(0, base * 0.6 - 20 * usdRate);
  }
  const icms = ((base + ii) / (1 - icmsRate)) * icmsRate;
  notes.push(`Estimativa: II ${baseUsd <= 50 ? "20%" : "60% (−US$ 20)"} + ICMS ${(icmsRate * 100).toFixed(0)}% por dentro, dólar PTAX R$ ${usdRate.toFixed(2)}.`);
  return { importTax: round(ii), icms: round(icms), notes };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
