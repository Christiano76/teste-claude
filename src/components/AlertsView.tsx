"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { brl } from "./format";

interface Alert { id: number; offerId: number | null; title: string | null; targetPrice: number; currentPrice: number | null; anyStore: boolean; hasEmail: boolean; active: boolean; createdAt: string; triggeredAt: string | null; triggeredPrice: number | null }
interface Notif { id: number; message: string; offerId: number | null; createdAt: string; read: boolean }

export function AlertsView() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const load = useCallback(() => {
    fetch("/api/alerts").then((r) => r.json()).then((d) => setAlerts(d.items ?? []));
    fetch("/api/notifications").then((r) => r.json()).then((d) => setNotifs(d.items ?? []));
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="pt-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Alertas de preço</h1>
        <p className="text-sm text-muted mt-1">Crie alertas na página de análise de qualquer oferta. Eles são verificados em cada atualização agendada dos preços.</p>
      </div>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Avisos recebidos</h2>
          {notifs.some((n) => !n.read) && <button className="text-xs text-accent" onClick={async () => { await fetch("/api/notifications", { method: "POST" }); load(); }}>marcar como lidos</button>}
        </div>
        {notifs.length === 0 ? <p className="text-sm text-faint">Nenhum aviso ainda.</p> : (
          <ul className="card divide-y divide-line">
            {notifs.map((n) => (
              <li key={n.id} className={`p-4 text-sm flex gap-3 ${n.read ? "text-muted" : ""}`}>
                {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-accent shrink-0" />}
                <span className="flex-1">{n.message}</span>
                {n.offerId && <Link href={`/oferta/${n.offerId}`} className="text-accent text-xs shrink-0">ver</Link>}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="font-semibold">Seus alertas</h2>
        {!alerts ? <div className="skeleton h-20 rounded-xl" /> : alerts.length === 0 ? <p className="text-sm text-faint">Nenhum alerta criado.</p> : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <li key={a.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
                <div className="flex-1 min-w-0">
                  <Link href={a.offerId ? `/oferta/${a.offerId}` : "#"} className="line-clamp-1 hover:text-accent">{a.title ?? "Oferta removida"}</Link>
                  <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-3">
                    <span>alvo <b className="text-fg num">{brl(a.targetPrice, 2)}</b></span>
                    <span>atual <span className="num">{brl(a.currentPrice, 2)}</span></span>
                    {a.anyStore && <span>qualquer loja</span>}
                    {a.hasEmail && <span>aviso por e-mail</span>}
                  </div>
                </div>
                <span className={`chip ${a.active ? "!text-accent !border-accent/30" : "!text-good !border-good/30"}`}>{a.active ? "monitorando" : `atingido ${a.triggeredPrice ? brl(a.triggeredPrice, 2) : ""}`}</span>
                <button className="text-xs text-faint hover:text-bad" onClick={async () => { await fetch("/api/alerts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id }) }); load(); }}>excluir</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
