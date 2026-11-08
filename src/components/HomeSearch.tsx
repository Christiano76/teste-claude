"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const MODES = [
  { id: "pc", label: "PC completo", hint: "Ex.: i5, gamer, Dell Optiplex" },
  { id: "pc-monitor", label: "PC + monitor", hint: "Ex.: i5 + 24 polegadas" },
  { id: "monitor", label: "Monitor", hint: "Ex.: 24 Full HD, 27 QHD 144Hz" },
  { id: "peca", label: "Peças", hint: "Ex.: GTX 1650, 16GB DDR4, SSD 480" },
] as const;

/** Barra de pesquisa central da página inicial: modo + termo + orçamento. */
export function HomeSearch() {
  const router = useRouter();
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("pc");
  const [q, setQ] = useState("");
  const [budget, setBudget] = useState("");
  const current = MODES.find((m) => m.id === mode)!;
  return (
    <form
      className="card p-3 sm:p-4 space-y-3 max-w-3xl"
      onSubmit={(e) => {
        e.preventDefault();
        const qs = new URLSearchParams();
        if (q.trim()) qs.set("q", q.trim());
        if (budget) qs.set("maxPrice", budget);
        router.push(`/buscar/${mode}${qs.size ? `?${qs}` : ""}`);
      }}
    >
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Modo de busca">
        {MODES.map((m) => (
          <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} onClick={() => setMode(m.id)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${mode === m.id ? "border-accent text-accent bg-accent/10" : "border-line text-muted hover:text-fg"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className="input flex-1 !py-3 !text-base" value={q} onChange={(e) => setQ(e.target.value)} placeholder={current.hint} aria-label="O que procurar" />
        <div className="relative sm:w-44">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint text-sm">até R$</span>
          <input className="input num !py-3 !pl-14 !text-base" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} placeholder="500" aria-label="Orçamento máximo em reais" />
        </div>
        <button className="btn btn-primary !py-3 !px-6 !text-base">Buscar</button>
      </div>
      <p className="text-xs text-faint">Busca em tempo real em lojas, marketplaces e classificados (novos, usados, seminovos e recondicionados). Sem preço mínimo.</p>
    </form>
  );
}
