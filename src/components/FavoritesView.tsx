"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { AnalyzedOffer } from "@/lib/types";
import { brl } from "./format";
import { CardSkeleton, OfferCard } from "./OfferCard";

type Fav = AnalyzedOffer & { priceAtSave: number | null };

export function FavoritesView() {
  const [items, setItems] = useState<Fav[] | null>(null);
  useEffect(() => {
    fetch("/api/favorites").then((r) => r.json()).then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
  }, []);
  return (
    <div className="pt-8 space-y-5">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Favoritos</h1>
        <p className="text-sm text-muted mt-1">Salvos neste navegador (sessão anônima). Mostramos a variação desde que você salvou.</p>
      </div>
      {!items ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <CardSkeleton key={i} />)}</div>
      ) : items.length === 0 ? (
        <div className="card p-8 text-center text-muted text-sm">Nenhum favorito ainda. Use o ♥ nos resultados da <Link className="text-accent" href="/buscar/pc">busca</Link>.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it, i) => {
            const delta = it.priceAtSave ? it.offer.price - it.priceAtSave : 0;
            return (
              <div key={it.offer.id} className="space-y-1.5">
                {it.priceAtSave != null && delta !== 0 && (
                  <div className={`text-xs px-1 ${delta < 0 ? "text-good" : "text-bad"}`}>{delta < 0 ? "▼ caiu" : "▲ subiu"} {brl(Math.abs(delta), 2)} desde que você salvou ({brl(it.priceAtSave, 2)})</div>
                )}
                {it.offer.available === false && <div className="text-xs px-1 text-bad">Indisponível na última verificação</div>}
                <OfferCard item={it} index={i} favorite />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
