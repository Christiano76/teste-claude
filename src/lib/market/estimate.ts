/**
 * Preço médio de mercado a partir de anúncios COMPARÁVEIS.
 * PC: ofertas novas com desempenho equivalente (±12%, ampliando para ±25%) e mesmo formato (com/sem monitor).
 * Monitor: ofertas novas com mesma resolução, frequência próxima e mesmo painel.
 * O resultado é ajustado pelo estado de conservação (um usado é comparado ao preço justo de um usado).
 */
import type { Condition, MarketEstimate } from "../types";
import { expectedPrice, type MarketCurve } from "../scoring/market";
import { CONDITION_FACTOR, CONDITION_LABEL } from "./condition";

export interface SamplePoint {
  id: number;
  x: number; // índice de desempenho (PC) ou qualidade (monitor)
  price: number;
  cond: Condition;
  kit?: boolean;
  cpu?: number | null;
  res?: string | null;
  hz?: number | null;
  panel?: string | null;
}

function median(v: number[]): number {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function estimateMarket(args: {
  id: number; category: "pc" | "monitor"; x: number | null; kit: boolean; cpu?: number | null; res?: string | null; hz?: number | null; panel?: string | null;
  cond: Condition; total: number; sample: SamplePoint[]; curve: MarketCurve; kitExtra: number;
}): MarketEstimate {
  const { id, x, cond, total, sample } = args;
  if (x == null) return { price: null, newPrice: null, comparables: 0, basis: "Sem dados suficientes para comparar (desempenho não identificado).", discount: null, savings: null };
  const pool = sample.filter((p) => p.id !== id && p.cond === "novo");
  let comps: SamplePoint[] = [];
  let basis = "";
  if (args.category === "pc") {
    for (const tol of [0.12, 0.25]) {
      // mesmo desempenho em jogos E processador de classe parecida (evita comparar um Pentium antigo com um i7 de escritório)
      const cpu = args.cpu;
      comps = pool.filter((p) => !!p.kit === args.kit && Math.abs(p.x - x) / x <= tol && (cpu == null || p.cpu == null || Math.abs(p.cpu - cpu) / cpu <= tol * 2));
      if (comps.length >= 5) { basis = `mediana de ${comps.length} PCs novos com desempenho e processador equivalentes (±${tol * 100}%)`; break; }
    }
  } else {
    comps = pool.filter((p) => p.res === args.res && p.hz && args.hz && Math.abs(p.hz - args.hz) / args.hz <= 0.2 && (!args.panel || !p.panel || p.panel === args.panel));
    if (comps.length >= 4) basis = `mediana de ${comps.length} monitores novos ${args.res} ~${args.hz} Hz${args.panel ? " " + args.panel : ""}`;
    else {
      comps = pool.filter((p) => Math.abs(p.x - x) <= 4);
      if (comps.length >= 5) basis = `mediana de ${comps.length} monitores novos de qualidade equivalente`;
    }
  }
  const enough = args.category === "pc" ? comps.length >= 5 : comps.length >= 4;
  let newPrice: number;
  if (enough) newPrice = median(comps.map((c) => c.price));
  else {
    newPrice = expectedPrice(args.curve, x) + args.kitExtra;
    basis = `curva de preço do mercado (${args.curve.source === "dados-coletados" ? `${args.curve.n} ofertas` : "referência"}) — poucos anúncios idênticos para comparar`;
    comps = [];
  }
  const factor = CONDITION_FACTOR[cond];
  const price = Math.round(newPrice * factor);
  if (factor !== 1) basis += `; ajustado para ${CONDITION_LABEL[cond].toLowerCase()} (${Math.round(factor * 100)}% do novo)`;
  const discount = 1 - total / price;
  return { price, newPrice: Math.round(newPrice), comparables: comps.length, basis, discount: Math.round(discount * 1000) / 1000, savings: Math.round(price - total) };
}
