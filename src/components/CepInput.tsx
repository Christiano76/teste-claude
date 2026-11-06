"use client";
import { useState } from "react";
import { useLocation } from "./Providers";

export function CepInput({ compact = false }: { compact?: boolean }) {
  const { location, setCep, clear } = useLocation();
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  if (location && !editing) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="chip !text-fg !border-line-strong"><Pin /> {location.city ? `${location.city}/${location.uf}` : location.uf} · {location.cep.replace(/(\d{5})(\d{3})/, "$1-$2")}</span>
        <button className="text-xs text-muted hover:text-accent" onClick={() => setEditing(true)}>alterar</button>
        {!compact && <button className="text-xs text-faint hover:text-bad" onClick={clear}>remover</button>}
      </div>
    );
  }
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await setCep(value);
        setBusy(false);
        setErr(r);
        if (!r) setEditing(false);
      }}
    >
      <input
        className={`input num ${compact ? "!py-1.5 w-32" : "w-40"}`}
        inputMode="numeric"
        placeholder="Seu CEP"
        aria-label="CEP para calcular frete e impostos"
        value={value}
        maxLength={9}
        onChange={(e) => setValue(e.target.value.replace(/[^\d-]/g, ""))}
      />
      <button className={`btn btn-ghost ${compact ? "!py-1.5" : ""}`} disabled={busy}>{busy ? "…" : "OK"}</button>
      {err && <span className="text-xs text-bad">{err}</span>}
    </form>
  );
}

function Pin() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
  );
}
