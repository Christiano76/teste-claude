"use client";
import { useEffect, useState } from "react";
import type { AnalyzedOffer } from "@/lib/types";
import { brl } from "./format";
import { CardSkeleton, OfferCard } from "./OfferCard";

interface Resp { newListings: AnalyzedOffer[]; priceDrops: { item: AnalyzedOffer; previous: number; current: number; at: string }[]; removed: { id: number; title: string; price: number; store: string; lastSeen: string; soldOut: boolean }[] }

export function RadarView() {
  const [d, setD] = useState<Resp | null>(null);
  useEffect(() => { fetch("/api/radar").then((r) => r.json()).then(setD); }, []);
  return (
    <div className="pt-8 space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Radar</h1>
        <p className="text-sm text-muted mt-1">Atualizado a cada coleta agendada: anúncios novos, quedas de preço e anúncios que saíram do ar ou esgotaram (últimas 48 h).</p>
      </div>
      <Block title="Quedas de preço" empty="Nenhuma queda de preço detectada ainda.">
        {d?.priceDrops.map((p, i) => (
          <div key={p.item.offer.id} className="space-y-1">
            <div className="text-xs text-good px-1">▼ {brl(p.previous, 2)} → {brl(p.current, 2)} (−{Math.round((1 - p.current / p.previous) * 100)}%)</div>
            <OfferCard item={p.item} index={i} />
          </div>
        ))}
      </Block>
      <Block title="Anúncios novos" empty="Nenhum anúncio novo desde a primeira coleta.">
        {d?.newListings.slice(0, 30).map((a, i) => <OfferCard key={a.offer.id} item={a} index={i} />)}
      </Block>
      <section className="space-y-3">
        <h2 className="font-semibold">Removidos ou esgotados</h2>
        {!d ? <div className="skeleton h-16 rounded-xl" /> : d.removed.length === 0 ? <p className="text-sm text-faint">Nenhum.</p> : (
          <ul className="card divide-y divide-line text-sm">{d.removed.map((r) => <li key={r.id} className="p-3 flex gap-3"><span className="flex-1 truncate">{r.title}</span><span className="text-faint shrink-0">{r.soldOut ? "esgotado" : "removido"} · {r.store}</span></li>)}</ul>
        )}
      </section>
    </div>
  );
}

function Block({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode[] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-semibold">{title}</h2>
      {children === undefined ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><CardSkeleton /><CardSkeleton /></div>
        : children.length === 0 ? <p className="text-sm text-faint">{empty}</p>
        : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>}
    </section>
  );
}
