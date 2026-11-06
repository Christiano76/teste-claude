/**
 * Curva de preço de mercado: quanto custa, hoje, um PC (ou monitor) com determinado
 * desempenho/qualidade. É ajustada com os dados reais coletados (regressão log-log
 * robusta). Sem dados suficientes, usa uma curva de referência conservadora.
 */
export interface MarketCurve {
  a: number;
  b: number;
  n: number;
  source: "dados-coletados" | "referencia";
}

/** Curvas de referência (fallback), calibradas com preços típicos de 2025–2026 no Brasil. */
export const REFERENCE: Record<"pc" | "monitor", MarketCurve> = {
  // preço ≈ e^a · x^b  → PC índice 100 ≈ R$ 4.000; índice 50 ≈ R$ 2.400; índice 200 ≈ R$ 8.000
  pc: { a: Math.log(4000) - 0.85 * Math.log(100), b: 0.85, n: 0, source: "referencia" },
  // monitor qualidade 60 ≈ R$ 750; 75 ≈ R$ 1.300; 90 ≈ R$ 2.600
  monitor: { a: Math.log(750) - 2.6 * Math.log(60), b: 2.6, n: 0, source: "referencia" },
};

export function expectedPrice(curve: MarketCurve, x: number): number {
  return Math.exp(curve.a + curve.b * Math.log(Math.max(1, x)));
}

/** Ajuste de mínimos quadrados em log-log, descartando 10% dos extremos de resíduo. */
export function fitCurve(points: { x: number; price: number }[], fallback: MarketCurve, minPoints = 25): MarketCurve {
  const pts = points.filter((p) => p.x > 0 && p.price > 0).map((p) => ({ lx: Math.log(p.x), ly: Math.log(p.price) }));
  if (pts.length < minPoints) return fallback;
  const solve = (arr: { lx: number; ly: number }[]) => {
    const n = arr.length;
    const mx = arr.reduce((s, p) => s + p.lx, 0) / n;
    const my = arr.reduce((s, p) => s + p.ly, 0) / n;
    let sxy = 0;
    let sxx = 0;
    for (const p of arr) {
      sxy += (p.lx - mx) * (p.ly - my);
      sxx += (p.lx - mx) ** 2;
    }
    const b = sxx > 0 ? sxy / sxx : fallback.b;
    return { a: my - b * mx, b };
  };
  let { a, b } = solve(pts);
  const resid = pts.map((p) => ({ p, r: Math.abs(p.ly - (a + b * p.lx)) })).sort((x, y) => x.r - y.r);
  const kept = resid.slice(0, Math.ceil(resid.length * 0.9)).map((x) => x.p);
  ({ a, b } = solve(kept));
  // Proteção: inclinação fora do plausível → mistura com a referência
  if (!(b > 0.2 && b < 4)) return { ...fallback, n: pts.length };
  return { a, b, n: kept.length, source: "dados-coletados" };
}
