import { scoreColor, VERDICT } from "./format";

export function ScoreBadge({ score, verdict, size = "md" }: { score: number; verdict?: string; size?: "sm" | "md" | "lg" }) {
  const dim = size === "lg" ? 76 : size === "md" ? 52 : 40;
  const stroke = size === "lg" ? 6 : 4.5;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(score);
  return (
    <div className="flex items-center gap-2.5" title={verdict ? VERDICT[verdict] : undefined}>
      <div className="relative shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={r} stroke="var(--color-line)" strokeWidth={stroke} fill="none" />
          <circle cx={dim / 2} cy={dim / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: "stroke-dashoffset .6s ease" }} />
        </svg>
        <span className={`absolute inset-0 grid place-items-center font-bold num ${size === "lg" ? "text-2xl" : size === "md" ? "text-base" : "text-sm"}`} style={{ color }}>{score}</span>
      </div>
      {verdict && size !== "sm" && <span className="text-xs font-semibold leading-tight" style={{ color }}>{VERDICT[verdict]}</span>}
    </div>
  );
}
