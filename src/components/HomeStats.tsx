"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Stats { stats: { offers: Record<string, number>; snapshots: number }; connectors: { id: string; name: string; state: string; configured: boolean }[] }

export function HomeStats() {
  const [d, setD] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/sources").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => setD(null));
  }, []);
  const active = d?.connectors.filter((c) => c.configured) ?? [];
  return (
    <section className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
      <Stat label="PCs monitorados" value={d ? (d.stats.offers.pc ?? 0).toLocaleString("pt-BR") : "…"} />
      <Stat label="Monitores monitorados" value={d ? (d.stats.offers.monitor ?? 0).toLocaleString("pt-BR") : "…"} />
      <Stat label="Registros de preço" value={d ? d.stats.snapshots.toLocaleString("pt-BR") : "…"} />
      <div>
        <div className="text-xs text-muted">Fontes ativas</div>
        <div className="text-sm mt-1">{d ? active.map((c) => c.name.split(" (")[0]).join(", ") || "nenhuma" : "…"}</div>
        <Link href="/fontes" className="text-xs text-accent">ver integrações →</Link>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold num mt-1">{value}</div>
    </div>
  );
}
