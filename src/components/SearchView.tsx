"use client";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzedOffer, ComboResult, SearchMode } from "@/lib/types";
import { ComboCard } from "./ComboCard";
import { CardSkeleton, OfferCard } from "./OfferCard";
import { useLocation } from "./Providers";

interface Facets { conditions: { value: string; count: number }[]; ufs: { value: string; count: number }[]; stores: { value: string; count: number }[]; brands: { value: string; count: number }[]; cpus: { value: string; count: number }[]; gpus: { value: string; count: number }[]; resolutions: { value: string; count: number }[] }
interface SourceRun { source: string; name: string; status: string; items: number; error?: string }
interface Progress { id: string; name: string; status: "pendente" | "consultando" | "ok" | "cached" | "error"; items: number; error?: string | null; kind: string }
interface Listing { url: string; platform: string; title: string; image_url: string | null; location: string | null; indexed_at: string | null; last_seen_at: string }
interface Resp { hiddenDefects?: number; counts?: { confirmed: number; indexed: number }; total: number; page: number; pageSize: number; results: AnalyzedOffer[]; combos?: ComboResult[]; kitInsight?: string | null; tiers?: { id: string; label: string; count: number }[]; needsCep?: boolean; facets: Facets; sources: SourceRun[]; market: { pc: { source: string; n: number }; monitor: { source: string; n: number } }; location: { uf: string; city: string } | null; error?: string }

const TITLES: Record<SearchMode, { title: string; sub: string; placeholder: string }> = {
  pc: { title: "PC completo", sub: "Computadores completos novos, usados, de escritório, gamers e recondicionados — informe o orçamento.", placeholder: "Ex.: i5, gamer, Dell Optiplex, GTX 1650…" },
  "pc-monitor": { title: "PC + monitor", sub: "Kits e combinações de anúncios separados dentro do orçamento total.", placeholder: "Ex.: i5, Ryzen, 24 polegadas…" },
  monitor: { title: "Monitor", sub: "Monitores novos e usados: resolução, tamanho, frequência e painel.", placeholder: "Ex.: 24 Full HD 75Hz, 27 QHD…" },
  peca: { title: "Peças", sub: "Placas de vídeo, processadores, memórias, SSDs, placas-mãe e fontes — comparadas com o mesmo modelo.", placeholder: "Ex.: GTX 1650, Ryzen 5 5600, 16GB DDR4, SSD 480…" },
  kit: { title: "Kits de hardware", sub: "Processador + placa-mãe (± memória), novos e usados.", placeholder: "Ex.: Ryzen 5 5600, B550, 16GB…" },
  "garimpo-entrega": { title: "Garimpo Extremo com entrega", sub: "PCs até R$ 500, R$ 700 e R$ 1.000, monitores até R$ 200 e kits muito baratos, só com envio confirmado para você. Custo total = produto + frete + taxas conhecidas.", placeholder: "Ex.: i5, GTX, 24…" },
};

const STORE_SLUG: Record<string, string> = { "KaBuM!": "kabum", "Mercado Livre": "mercadolivre", "Amazon Brasil": "amazon-br", Shopee: "shopee", AliExpress: "aliexpress" };
const slugOf = (name: string) => STORE_SLUG[name] ?? name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const FILTER_KEYS = ["confirmed", "entrega", "tier", "garimpo", "cond", "uf", "seller", "pickup", "q", "minPrice", "maxPrice", "cpu", "gpu", "minRam", "minStorage", "brand", "stores", "freeShipping", "origin", "maxDays", "resolution", "minRefresh", "minScore", "kit", "unconfirmed", "sort", "page"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function SearchView() {
  const { modo } = useParams<{ modo: string }>();
  const mode: SearchMode = modo === "monitor" || modo === "pc-monitor" || modo === "kit" || modo === "peca" || modo === "garimpo-entrega" ? modo : "pc";
  const [progress, setProgress] = useState<Progress[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { location } = useLocation();
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  const filters = useMemo(() => {
    const f: Partial<Record<FilterKey, string>> = {};
    for (const k of FILTER_KEYS) {
      const v = sp.get(k);
      if (v) f[k] = v;
    }
    return f;
  }, [sp]);

  const setFilter = (patch: Partial<Record<FilterKey, string | null>>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const ctrl = new AbortController();
    const qs = new URLSearchParams({ mode, ...filters } as Record<string, string>);
    if (location?.cep) qs.set("cep", location.cep);
    if (refreshTick > 0) qs.set("refresh", "1");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // 1) consulta cada fonte em paralelo mostrando o progresso; 2) analisa e classifica
    (async () => {
      const src = await fetch("/api/sources", { signal: ctrl.signal }).then((r) => r.json()) as { connectors: { id: string; name: string; configured: boolean; kind: string }[] };
      const active = src.connectors.filter((c) => c.configured);
      const prog: Progress[] = active.map((c) => ({ id: c.id, name: c.name.replace(/ \(.*\)$/, ""), status: "pendente", items: 0, kind: c.kind }));
      const unavailable = src.connectors.filter((c) => !c.configured).map((c) => ({ id: c.id, name: c.name.replace(/ \(.*\)$/, ""), status: "error" as const, items: 0, kind: c.kind, error: "indisponível (sem integração/credenciais)" }));
      setProgress([...prog, ...unavailable]);
      const update = (id: string, patch: Partial<Progress>) => setProgress((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const queue = [...prog];
      const worker = async () => {
        for (let it = queue.shift(); it; it = queue.shift()) {
          update(it.id, { status: "consultando" });
          try {
            const r = await fetch("/api/collect", { method: "POST", signal: ctrl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: it.id, mode, q: filters.q, cep: location?.cep, maxPrice: filters.maxPrice ? Number(filters.maxPrice) : undefined, refresh: refreshTick > 0 }) }).then((x) => x.json());
            update(it.id, { status: r.status ?? "error", items: r.items ?? 0, error: r.error ?? r.issues?.join(", ") ?? null });
          } catch (e) {
            if ((e as Error).name === "AbortError") return;
            update(it.id, { status: "error", error: String(e) });
          }
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      const d = (await fetch(`/api/search?${qs}`, { signal: ctrl.signal }).then((r) => r.json())) as Resp;
      setData(d);
      setLoading(false);
      const cat = mode === "pc-monitor" || mode === "garimpo-entrega" ? "pc" : mode;
      fetch(`/api/listings?category=${cat}&q=${encodeURIComponent(filters.q ?? "")}`, { signal: ctrl.signal }).then((r) => r.json()).then((l) => setListings(l.items ?? [])).catch(() => {});
    })()
      .catch((e) => {
        if (e.name !== "AbortError") {
          setData({ error: String(e) } as Resp);
          setLoading(false);
        }
      });
    return () => ctrl.abort();
  }, [mode, filters, location?.cep, refreshTick]);

  const t = TITLES[mode];
  const page = Number(filters.page ?? 1);
  const pages = data && !data.error ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="pt-6 sm:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="text-muted text-sm mt-1">{t.sub}{location ? ` Resultados personalizados para ${location.city || location.uf}/${location.uf}.` : " Informe o CEP no topo para personalizar frete e impostos."}</p>
        </div>
        <SearchBox initial={filters.q ?? ""} budget={filters.maxPrice ?? ""} placeholder={t.placeholder} onSubmit={(q, b) => setFilter({ q, maxPrice: b || null })} />
      </div>

      {mode === "garimpo-entrega" && (
        <div className="mb-4 space-y-3">
          {(data?.needsCep ?? !location) && <div className="card p-4 text-sm border-mid/40 text-mid">Informe seu CEP no topo: sem ele não dá para confirmar anúncios com envio só local.</div>}
          <div className="flex flex-wrap gap-2">
            <TierChip active={!filters.tier} label="Todas as faixas" count={data?.tiers?.reduce((n, t) => n + t.count, 0)} onClick={() => setFilter({ tier: null })} />
            {data?.tiers?.map((t) => <TierChip key={t.id} active={filters.tier === t.id} label={t.label} count={t.count} onClick={() => setFilter({ tier: t.id })} />)}
          </div>
          <p className="text-xs text-muted">Só entram anúncios com <b>envio confirmado</b> pela fonte, disponíveis e sem alto risco. Preço baixo não significa anúncio confiável: confira as notas e o risco de cada um e pague sempre pela plataforma.</p>
        </div>
      )}
      {mode !== "pc-monitor" && mode !== "garimpo-entrega" && (
        <button type="button" onClick={() => setFilter({ garimpo: filters.garimpo ? null : "1", sort: filters.garimpo ? null : "discount" })}
          className={`w-full mb-4 text-left rounded-xl border p-4 transition-colors ${filters.garimpo ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
          <span className="font-bold tracking-wide text-accent">GARIMPO EXTREMO {filters.garimpo ? "· ativo" : ""}</span>
          <span className="block text-xs text-muted mt-1">Só anúncios pelo menos 20% abaixo da média de anúncios comparáveis no mesmo estado (novos, usados, seminovos, recondicionados), com dados suficientes e sem alto risco. Máquinas obsoletas ficam de fora.</span>
        </button>
      )}
      <ProgressPanel progress={progress} loading={loading} onRefresh={() => setRefreshTick((x) => x + 1)} />

      <div className="flex gap-6 mt-5">
        <aside className={`${drawer ? "fixed inset-0 z-40 bg-bg/95 backdrop-blur p-4 overflow-y-auto" : "hidden"} lg:block lg:static lg:bg-transparent lg:p-0 lg:w-64 shrink-0`}>
          <div className="lg:hidden flex justify-between items-center mb-4">
            <span className="font-semibold">Filtros</span>
            <button className="btn btn-ghost" onClick={() => setDrawer(false)}>Aplicar</button>
          </div>
          <Filters mode={mode} f={filters} facets={data?.facets} set={setFilter} />
        </aside>

        <section className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <button className="lg:hidden btn btn-ghost" onClick={() => setDrawer(true)}>Filtros{Object.keys(filters).filter((k) => !["sort", "page", "q"].includes(k)).length ? ` (${Object.keys(filters).filter((k) => !["sort", "page", "q"].includes(k)).length})` : ""}</button>
            <span className="text-sm text-muted hidden sm:block num">{loading ? "Buscando e analisando ofertas…" : data?.error ? "" : `${data?.total.toLocaleString("pt-BR")} ${mode === "pc-monitor" ? "conjuntos" : "ofertas"} analisadas`}</span>
            {mode !== "pc-monitor" && (
              <select className="input !w-auto" value={filters.sort ?? "entrega"} onChange={(e) => setFilter({ sort: e.target.value === "entrega" ? null : e.target.value })} aria-label="Ordenar">
                <option value="entrega">Entrega verificável + menor custo</option>
                <option value="price">Menor custo total</option>
                <option value="score">Melhor nota geral</option>
                <option value="performance">{mode === "monitor" ? "Melhor qualidade" : "Maior desempenho"}</option>
                <option value="delivery">Entrega mais rápida</option>
                <option value="discount">Maior desconto real</option>
                <option value="value">Melhor custo-benefício</option>
              </select>
            )}
          </div>

          {data?.error && <div className="card p-6 text-bad text-sm">Erro ao buscar: {data.error}</div>}
          {!loading && data && !data.error && (
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {data.counts && <span className="chip !text-good !border-good/40">{data.counts.confirmed} com preço confirmado na fonte</span>}
              {data.counts && <span className="chip !text-mid !border-mid/40">{data.counts.indexed} encontrados via buscador (preço não confirmado)</span>}
              {!!data.hiddenDefects && <span className="chip !text-bad !border-bad/40">{data.hiddenDefects} anúncio(s) com defeito ocultado(s)</span>}
            </div>
          )}
          {mode === "pc-monitor" && data?.kitInsight && !loading && <div className="card p-4 mb-4 text-sm border-accent/30"><span className="text-accent font-semibold">Kit ou separado? </span>{data.kitInsight}</div>}

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
          ) : mode === "pc-monitor" ? (
            <div className="space-y-4">{data?.combos?.map((c, i) => <ComboCard key={`${c.pc.offer.id}-${c.monitor?.offer.id ?? "kit"}`} combo={c} index={i} />)}</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data?.results.map((r, i) => <OfferCard key={r.offer.id} item={r} index={i} />)}</div>
          )}
          {!loading && data && !data.error && data.total === 0 && (
            <div className="card p-8 text-center text-muted text-sm">Nenhuma oferta com disponibilidade confirmada para esses filtros. Tente ampliar os filtros ou incluir ofertas com estoque não confirmado.</div>
          )}
          {!loading && pages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8">
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setFilter({ page: String(page - 1) })}>← Anterior</button>
              <span className="text-sm text-muted num px-2">{page} / {pages}</span>
              <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setFilter({ page: String(page + 1) })}>Próxima →</button>
            </div>
          )}
          {!loading && listings.length > 0 && (
            <section className="mt-10">
              <h2 className="font-semibold">Anúncios encontrados sem preço no índice ({listings.length})</h2>
              <p className="text-xs text-muted mb-3">O buscador encontrou estes anúncios individuais, mas sem preço publicado nos dados indexados. Abra o anúncio para conferir preço, estado e entrega.</p>
              <ul className="card divide-y divide-line text-sm">
                {listings.slice(0, 30).map((l) => (
                  <li key={l.url} className="p-3 flex items-center gap-3">
                    <span className="chip shrink-0">{l.platform}</span>
                    <span className="flex-1 min-w-0 truncate" title={l.title}>{l.title}</span>
                    {l.location && <span className="text-faint text-xs shrink-0 hidden sm:inline">{l.location}</span>}
                    <a className="btn btn-ghost !py-1 !px-2 text-xs shrink-0" href={l.url} target="_blank" rel="noopener noreferrer nofollow">Ver oferta</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!loading && data?.market && (
            <p className="text-[11px] text-faint mt-8">
              Custo-benefício calculado contra a curva de preço de mercado ({mode === "monitor" ? data.market.monitor.source === "dados-coletados" ? `${data.market.monitor.n} monitores coletados` : "curva de referência" : data.market.pc.source === "dados-coletados" ? `${data.market.pc.n} PCs coletados` : "curva de referência"}). Desempenho é estimativa baseada em benchmarks públicos agregados, não FPS medido.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function ProgressPanel({ progress, loading, onRefresh }: { progress: Progress[]; loading: boolean; onRefresh: () => void }) {
  if (!progress.length) return null;
  const done = progress.filter((p) => p.status !== "pendente" && p.status !== "consultando").length;
  const label = (p: Progress) =>
    p.status === "pendente" ? "na fila" : p.status === "consultando" ? "consultando…" : p.status === "error" ? (p.error?.startsWith("indisponível") ? "fonte indisponível" : "erro") : p.status === "cached" ? "dados recentes" : `${p.items} anúncio(s)`;
  const cls = (p: Progress) =>
    p.status === "error" ? "!text-bad !border-bad/40" : p.status === "consultando" || p.status === "pendente" ? "!text-muted" : p.kind === "search-index" ? "!text-mid !border-mid/40" : "!text-good !border-good/40";
  return (
    <details className="card p-3 text-xs" open={loading}>
      <summary className="cursor-pointer flex items-center gap-3">
        <span className="font-semibold text-sm">{loading ? `Consultando fontes… ${done}/${progress.length}` : `Fontes consultadas: ${progress.filter((p) => p.status === "ok" || p.status === "cached").length} responderam`}</span>
        {loading && <span className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden"><span className="block h-full bg-accent transition-all" style={{ width: `${(done / progress.length) * 100}%` }} /></span>}
        {!loading && <button type="button" className="text-accent ml-auto" onClick={(e) => { e.preventDefault(); onRefresh(); }}>atualizar agora</button>}
      </summary>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {progress.map((p) => <span key={p.id} className={`chip ${cls(p)}`} title={p.error ?? undefined}>{p.name} · {label(p)}</span>)}
      </div>
      <p className="text-faint mt-2">Verde: preço vindo direto da fonte. Amarelo: anúncio encontrado pelo buscador (Brave), preço do índice sem confirmação. Vermelho: fonte indisponível ou com erro.</p>
    </details>
  );
}

function SearchBox({ initial, budget, placeholder, onSubmit }: { initial: string; budget: string; placeholder: string; onSubmit: (q: string, budget: string) => void }) {
  const [q, setQ] = useState(initial);
  const [b, setB] = useState(budget);
  return (
    <form className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-[34rem]" onSubmit={(e) => { e.preventDefault(); onSubmit(q.trim(), b.replace(/\D/g, "")); }}>
      <input className="input flex-1 min-w-0" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="O que procurar" />
      <input className="input num !w-36" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} placeholder="Orçamento R$" aria-label="Orçamento máximo em reais" />
      <button className="btn btn-primary">Buscar</button>
    </form>
  );
}
function Filters({ mode, f, facets, set }: { mode: SearchMode; f: Partial<Record<FilterKey, string>>; facets?: Facets; set: (p: Partial<Record<FilterKey, string | null>>) => void }) {
  const storesSel = new Set((f.stores ?? "").split(",").filter(Boolean));
  const isPc = mode !== "monitor";
  const isMon = mode !== "pc";
  return (
    <div className="space-y-5 text-sm">
      <Group label={mode === "pc-monitor" ? "Orçamento total (R$)" : "Preço (R$)"}>
        <div className="flex gap-2">
          <NumInput placeholder="mín." value={f.minPrice} onCommit={(v) => set({ minPrice: v })} />
          <NumInput placeholder="máx." value={f.maxPrice} onCommit={(v) => set({ maxPrice: v })} />
        </div>
      </Group>
      <Check label="Somente preço confirmado na fonte" checked={!!f.confirmed} onChange={(v) => set({ confirmed: v ? "1" : null })} />
      <Group label="Estado de conservação">
        <div className="space-y-1.5">
          {(["novo", "seminovo", "usado", "recondicionado", "mostruario", "nao-informado"] as const).map((c) => {
            const sel = new Set((f.cond ?? "").split(",").filter(Boolean));
            const n = facets?.conditions?.find((x) => x.value === c)?.count;
            return (
              <label key={c} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={sel.has(c)} onChange={(e) => { if (e.target.checked) sel.add(c); else sel.delete(c); set({ cond: [...sel].join(",") || null }); }} />
                <span className="flex-1">{CONDITION_LABELS[c]}</span><span className="text-faint num">{n ?? ""}</span>
              </label>
            );
          })}
          <p className="text-[11px] text-faint">Nenhum marcado = todos os estados.</p>
        </div>
      </Group>
      <Group label="Vendedor">
        <Seg options={[["", "Todos"], ["loja,profissional", "Profissional"], ["pessoa-fisica", "Pessoa física"]]} value={f.seller ?? ""} onChange={(v) => set({ seller: v })} />
      </Group>
      <Group label="Localização do vendedor (UF)">
        <select className="input" value={f.uf ?? ""} onChange={(e) => set({ uf: e.target.value || null })}>
          <option value="">Qualquer</option>
          {facets?.ufs?.map((u) => <option key={u.value} value={u.value}>{u.value} ({u.count})</option>)}
        </select>
      </Group>
      <Group label="Nota mínima">
        <Seg options={[["", "Todas"], ["60", "60+"], ["75", "75+"], ["90", "90+"]]} value={f.minScore ?? ""} onChange={(v) => set({ minScore: v })} />
      </Group>
      {isPc && (
        <>
          <Group label="Processador">
            <Select value={f.cpu} onChange={(v) => set({ cpu: v })} options={facets?.cpus} any="Qualquer" />
          </Group>
          <Group label="Placa de vídeo">
            <Select value={f.gpu} onChange={(v) => set({ gpu: v })} options={facets?.gpus} any="Qualquer" />
          </Group>
          <Group label="Memória RAM mínima">
            <Seg options={[["", "—"], ["8", "8"], ["16", "16"], ["32", "32"], ["64", "64"]]} value={f.minRam ?? ""} onChange={(v) => set({ minRam: v })} suffix=" GB" />
          </Group>
          <Group label="Armazenamento mínimo">
            <Seg options={[["", "—"], ["480", "480 GB"], ["1000", "1 TB"], ["2000", "2 TB"]]} value={f.minStorage ?? ""} onChange={(v) => set({ minStorage: v })} />
          </Group>
          {mode === "pc" && (
            <Group label="Kits com monitor">
              <Seg options={[["", "Todos"], ["exclude", "Só o PC"], ["only", "Só kits"]]} value={f.kit ?? ""} onChange={(v) => set({ kit: v })} />
            </Group>
          )}
        </>
      )}
      {mode === "monitor" && (
        <>
          <Group label="Resolução">
            <Select value={f.resolution} onChange={(v) => set({ resolution: v })} options={facets?.resolutions} any="Qualquer" />
          </Group>
          <Group label="Frequência mínima">
            <Seg options={[["", "—"], ["75", "75"], ["144", "144"], ["165", "165"], ["240", "240"]]} value={f.minRefresh ?? ""} onChange={(v) => set({ minRefresh: v })} suffix=" Hz" />
          </Group>
        </>
      )}
      {mode !== "pc-monitor" && (
        <>
          <Group label="Marca">
            <Select value={f.brand} onChange={(v) => set({ brand: v })} options={facets?.brands} any="Qualquer" />
          </Group>
          <Group label="Loja">
            <div className="space-y-1.5">
              {(facets?.stores ?? []).map((s) => (
                <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="accent-[var(--color-accent)]" checked={storesSel.has(slugOf(s.value))} onChange={(e) => {
                    const next = new Set(storesSel);
                    if (e.target.checked) next.add(slugOf(s.value)); else next.delete(slugOf(s.value));
                    set({ stores: [...next].join(",") || null });
                  }} />
                  <span className="flex-1">{s.value}</span><span className="text-faint num">{s.count}</span>
                </label>
              ))}
              {!facets?.stores?.length && <span className="text-faint text-xs">—</span>}
            </div>
          </Group>
        </>
      )}
      {isMon && mode === "pc-monitor" && <p className="text-xs text-faint">Combinações usam os melhores monitores disponíveis para cada PC.</p>}
      <Group label="Entrega">
        <div className="space-y-2">
          {mode !== "garimpo-entrega" && (
            <div className="space-y-1">
              {([["", "Qualquer modalidade"], ["entrega", "Somente com entrega disponível"], ["ambos", "Entrega ou retirada presencial"], ["retirada", "Somente retirada presencial"]] as const).map(([v, l]) => (
                <label key={v} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="entrega" className="accent-[var(--color-accent)]" checked={(f.entrega ?? "") === v} onChange={() => set({ entrega: v || null })} />
                  <span>{l}</span>
                </label>
              ))}
              <p className="text-[11px] text-faint">“Somente entrega” exclui anúncios sem envio confirmado para o seu CEP.</p>
            </div>
          )}
          <Check label="Somente frete grátis" checked={!!f.freeShipping} onChange={(v) => set({ freeShipping: v ? "1" : null })} />
          <Check label="Aceita retirada presencial" checked={!!f.pickup} onChange={(v) => set({ pickup: v ? "1" : null })} />
          <Seg options={[["", "Todas"], ["BR", "Nacional"], ["INTL", "Internacional"]]} value={f.origin ?? ""} onChange={(v) => set({ origin: v })} />
          <select className="input" value={f.maxDays ?? ""} onChange={(e) => set({ maxDays: e.target.value || null })} aria-label="Prazo máximo">
            <option value="">Qualquer prazo</option>
            <option value="2">Até 2 dias (verificado)</option>
            <option value="5">Até 5 dias (verificado)</option>
            <option value="10">Até 10 dias (verificado)</option>
          </select>
        </div>
      </Group>
      <Check label="Incluir estoque não confirmado" checked={!!f.unconfirmed} onChange={(v) => set({ unconfirmed: v ? "1" : null })} />
    </div>
  );
}

const CONDITION_LABELS: Record<string, string> = { novo: "Novo", seminovo: "Seminovo", usado: "Usado", recondicionado: "Recondicionado", mostruario: "Mostruário", "nao-informado": "Não informado" };

function TierChip({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${active ? "border-accent text-accent bg-accent/10" : "border-line text-muted hover:text-fg"}`}>
      {label}{count != null && <span className="num text-faint"> · {count}</span>}
    </button>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-faint mb-2">{label}</div>
      {children}
    </div>
  );
}

function Seg({ options, value, onChange, suffix = "" }: { options: [string, string][]; value: string; onChange: (v: string | null) => void; suffix?: string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v || null)} className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${value === v ? "border-accent text-accent bg-accent/5" : "border-line text-muted hover:text-fg"}`}>
          {l}{v && suffix}
        </button>
      ))}
    </div>
  );
}

function Select({ value, onChange, options, any }: { value?: string; onChange: (v: string | null) => void; options?: { value: string; count: number }[]; any: string }) {
  return (
    <select className="input" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{any}</option>
      {value && !options?.some((o) => o.value === value) && <option value={value}>{value}</option>}
      {options?.map((o) => <option key={o.value} value={o.value}>{o.value} ({o.count})</option>)}
    </select>
  );
}

function NumInput({ value, placeholder, onCommit }: { value?: string; placeholder: string; onCommit: (v: string | null) => void }) {
  const [v, setV] = useState(value ?? "");
  return <input className="input num" inputMode="numeric" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} onBlur={() => onCommit(v || null)} onKeyDown={(e) => e.key === "Enter" && onCommit(v || null)} />;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" className="accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
