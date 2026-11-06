"use client";
import Link from "next/link";
import type { AnalyzedOffer, ComboResult } from "@/lib/types";
import { brl, deliveryText } from "./format";
import { specLine } from "./OfferCard";
import { ScoreBadge } from "./ScoreBadge";

function Part({ label, item }: { label: string; item: AnalyzedOffer }) {
  const o = item.offer;
  return (
    <div className="flex gap-3 min-w-0">
      <Link href={`/oferta/${o.id}`} className="shrink-0 w-20 h-20 rounded-lg bg-white/95 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {o.imageUrl && <img src={o.imageUrl} alt="" loading="lazy" className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-faint">{label} · nota {item.analysis.score}</div>
        <Link href={`/oferta/${o.id}`} className="text-sm leading-snug line-clamp-2 hover:text-accent" title={o.title}>{o.title}</Link>
        <div className="text-xs text-muted mt-1 truncate">{specLine(item).slice(0, 4).join(" · ")}</div>
        <div className="text-xs mt-1 flex flex-wrap gap-x-3"><span className="num font-semibold">{brl(item.analysis.cost.total)}</span><span className="text-muted">{o.storeName}</span><span className="text-faint">{deliveryText(o)}</span></div>
      </div>
      <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-ghost self-center !px-2.5 !py-1.5 text-xs shrink-0">Loja</a>
    </div>
  );
}

export function ComboCard({ combo, index = 0 }: { combo: ComboResult; index?: number }) {
  return (
    <article className="card p-4 sm:p-5 flex flex-col gap-4 animate-rise" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ScoreBadge score={combo.score} verdict={combo.verdict} />
          <span className={`chip ${combo.kind === "kit" ? "!text-accent-2 !border-accent-2/40" : "!text-accent !border-accent/40"}`}>{combo.kind === "kit" ? "Kit (monitor incluso)" : "Comprados separadamente"}</span>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted">Total do conjunto</div>
          <div className="text-2xl font-bold num">{brl(combo.total)}</div>
          {!combo.totalIsComplete && <div className="text-[11px] text-faint">+ frete não verificado</div>}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Part label={combo.kind === "kit" ? "Kit PC + monitor" : "PC"} item={combo.pc} />
        {combo.monitor && <Part label="Monitor" item={combo.monitor} />}
      </div>
      <ul className="text-xs text-muted space-y-0.5">{combo.matchNotes.map((n) => <li key={n}>• {n}</li>)}</ul>
    </article>
  );
}
