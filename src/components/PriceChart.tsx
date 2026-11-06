"use client";
import { useState } from "react";

const renderedAt = () => Date.now();
import { brl } from "./format";

export interface Point { price: number; capturedAt: string }

/** Gráfico de histórico de preço em SVG puro (degraus, pois o preço vale até mudar). */
export function PriceChart({ points, current }: { points: Point[]; current: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [now] = useState(renderedAt);
  if (points.length < 2) {
    return <div className="text-sm text-muted py-6 text-center">Histórico em formação — {points.length} registro(s). O PC Hunter registra o preço a cada atualização.</div>;
  }
  const W = 640, H = 200, P = { l: 56, r: 12, t: 12, b: 26 };
  const xs = points.map((p) => new Date(p.capturedAt).getTime());
  const t0 = xs[0], t1 = Math.max(now, xs[xs.length - 1]);
  const prices = points.map((p) => p.price);
  const lo = Math.min(...prices) * 0.97, hi = Math.max(...prices) * 1.03;
  const x = (t: number) => P.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - P.t - P.b);
  let d = `M${x(xs[0])},${y(prices[0])}`;
  for (let i = 1; i < points.length; i++) d += ` H${x(xs[i])} V${y(prices[i])}`;
  d += ` H${x(t1)}`;
  const min = Math.min(...prices);
  const ticks = [lo, (lo + hi) / 2, hi];
  const h = hover != null ? points[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Histórico de preços"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const t = t0 + (((e.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r) * (t1 - t0);
          let idx = 0;
          for (let i = 0; i < xs.length; i++) if (xs[i] <= t) idx = i;
          setHover(idx);
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="3 4" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-faint)">{brl(t)}</text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(min)} y2={y(min)} stroke="var(--color-good)" strokeOpacity=".4" />
        <path d={d} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
        {h && <circle cx={x(new Date(h.capturedAt).getTime())} cy={y(h.price)} r="4" fill="var(--color-accent)" />}
        <text x={P.l} y={H - 6} fontSize="10" fill="var(--color-faint)">{new Date(t0).toLocaleDateString("pt-BR")}</text>
        <text x={W - P.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-faint)">hoje</text>
      </svg>
      <div className="text-xs text-muted mt-1 flex justify-between">
        <span>{h ? `${new Date(h.capturedAt).toLocaleString("pt-BR")}: ${brl(h.price, 2)}` : `Atual: ${brl(current, 2)}`}</span>
        <span className="text-good">mínimo {brl(min, 2)}</span>
      </div>
    </div>
  );
}
