"use client";
import { useState } from "react";

export function FavoriteButton({ offerId, initial = false, onChange }: { offerId: number; initial?: boolean; onChange?: (v: boolean) => void }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button
      aria-label={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
      title={fav ? "Remover dos favoritos" : "Salvar nos favoritos"}
      disabled={busy}
      className={`p-2 rounded-lg border transition-colors ${fav ? "border-accent text-accent" : "border-line text-muted hover:text-fg hover:border-line-strong"}`}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        const res = await fetch("/api/favorites", { method: fav ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId }) });
        setBusy(false);
        if (res.ok) {
          setFav(!fav);
          onChange?.(!fav);
        }
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 21l-1.4-1.3C5.4 15 2 12 2 8.4 2 5.4 4.4 3 7.4 3c1.7 0 3.4.8 4.6 2.1C13.2 3.8 14.9 3 16.6 3 19.6 3 22 5.4 22 8.4c0 3.6-3.4 6.6-8.6 11.3L12 21z" /></svg>
    </button>
  );
}
