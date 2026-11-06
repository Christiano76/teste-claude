"use client";
import { useEffect, useState } from "react";

interface Conn { id: string; name: string; kind: string; state: string; configured: boolean; message: string; requires: string[]; docsUrl: string; lastRun: { status: string; items: number; error: string | null; finished_at: string | null } | null; lastOk: string | null; items24h: number }
interface Resp { connectors: Conn[]; unsupported: { store: string; reason: string }[]; stats: { offers: Record<string, number>; snapshots: number; historySince: string | null }; stores: { slug: string; name: string; reputation: number | null; discovered_via: string; offers: number }[]; auxiliary: { name: string; purpose: string; state: string }[] }

const STATE: Record<string, [string, string]> = {
  ok: ["Funcionando", "text-good border-good/30"],
  unverified: ["Configurado", "text-accent border-accent/30"],
  "needs-credentials": ["Requer credenciais", "text-mid border-mid/30"],
  blocked: ["Bloqueado", "text-bad border-bad/30"],
  disabled: ["Desativado", "text-faint border-line"],
};

const KIND: Record<string, string> = { "public-json": "Catálogo público", "official-api": "API oficial", "affiliate-api": "API de afiliados", feed: "Feed de produtos" };

export function SourcesView() {
  const [d, setD] = useState<Resp | null>(null);
  useEffect(() => {
    fetch("/api/sources").then((r) => r.json()).then(setD);
  }, []);
  if (!d) return <div className="pt-10 skeleton h-64 rounded-xl" />;
  return (
    <div className="pt-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Fontes e integrações</h1>
        <p className="text-sm text-muted mt-1">Status real de cada fonte de dados. Nenhuma oferta é inventada: se uma fonte não responde, ela simplesmente não aparece nos resultados.</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4"><div className="text-xs text-muted">Ofertas ativas</div><div className="text-2xl font-bold num">{Object.values(d.stats.offers).reduce((a, b) => a + b, 0).toLocaleString("pt-BR")}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Registros de preço</div><div className="text-2xl font-bold num">{d.stats.snapshots.toLocaleString("pt-BR")}</div></div>
        <div className="card p-4"><div className="text-xs text-muted">Histórico desde</div><div className="text-lg font-semibold">{d.stats.historySince ? new Date(d.stats.historySince).toLocaleDateString("pt-BR") : "—"}</div></div>
      </div>
      <section className="space-y-3">
        <h2 className="font-semibold">Conectores de ofertas</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {d.connectors.map((c) => {
            const effective = c.lastRun?.status === "error" ? "blocked" : c.lastRun?.status === "ok" ? "ok" : c.state;
            const [label, cls] = STATE[effective] ?? STATE.unverified;
            return (
              <div key={c.id} className="card p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className={`chip ${cls}`}>{label}</span>
                </div>
                <div className="text-xs text-faint">{KIND[c.kind]}</div>
                <p className="text-sm text-muted">{c.message}</p>
                {c.lastRun && <p className="text-xs text-muted">Última coleta: {c.lastRun.status === "ok" ? `${c.lastRun.items} itens` : `erro — ${c.lastRun.error}`} {c.lastRun.finished_at && `· ${new Date(c.lastRun.finished_at).toLocaleString("pt-BR")}`}</p>}
                {c.items24h > 0 && <p className="text-xs text-muted">{c.items24h.toLocaleString("pt-BR")} itens coletados nas últimas 24 h</p>}
                {!c.configured && c.requires.length > 0 && <p className="text-xs"><span className="text-faint">Variáveis: </span><code className="text-mid">{c.requires.join(", ")}</code></p>}
                <a href={c.docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-accent">documentação →</a>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Lojas sem integração direta</h2>
        <ul className="card divide-y divide-line">
          {d.unsupported.map((u) => <li key={u.store} className="p-4 text-sm"><span className="font-medium">{u.store}</span><p className="text-muted text-xs mt-1">{u.reason}</p></li>)}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Serviços auxiliares</h2>
        <ul className="card divide-y divide-line">
          {d.auxiliary.map((a) => <li key={a.name} className="p-4 text-sm flex items-center gap-3"><span className="flex-1"><span className="font-medium">{a.name}</span><span className="block text-xs text-muted">{a.purpose}</span></span><span className={`chip ${STATE[a.state]?.[1]}`}>{STATE[a.state]?.[0]}</span></li>)}
        </ul>
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Lojas conhecidas e descobertas</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-faint text-left"><tr><th className="p-3">Loja</th><th className="p-3">Reputação base</th><th className="p-3">Origem</th><th className="p-3 text-right">Ofertas ativas</th></tr></thead>
            <tbody>{d.stores.map((s) => <tr key={s.slug} className="border-t border-line"><td className="p-3">{s.name}</td><td className="p-3 num">{s.reputation ?? "—"}</td><td className="p-3 text-muted">{s.discovered_via === "seed" ? "cadastro inicial" : `descoberta via ${s.discovered_via}`}</td><td className="p-3 text-right num">{s.offers}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
