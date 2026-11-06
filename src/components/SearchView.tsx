"use client";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { AnalyzedOffer, ComboResult, SearchMode } from "@/lib/types";
import { ComboCard } from "./ComboCard";
import { CardSkeleton, OfferCard } from "./OfferCard";
import { useLocation } from "./Providers";

interface Facets { conditions: { value: string; count: number }[]; ufs: { value: string; count: number }[]; stores: { value: string; count: number }[]; brands: { value: string; count: number }[]; cpus: { value: string; count: number }[]; gpus: { value: string; count: number }[]; resolutions: { value: string; count: number }[] }
interface SourceRun { source: string; name: string; status: string; items: number; error?: string }
interface Resp { total: number; page: number; pageSize: number; results: AnalyzedOffer[]; combos?: ComboResult[]; kitInsight?: string | null; facets: Facets; sources: SourceRun[]; market: { pc: { source: string; n: number }; monitor: { source: string; n: number } }; location: { uf: string; city: string } | null; error?: string }

const TITLES: Record<SearchMode, { title: string; sub: string; placeholder: string }> = {
  pc: { title: "PC Gamer", sub: "Computadores completos, prontos para uso.", placeholder: "Ex.: RTX 4060, Ryzen 5 5600, 32GB…" },
  "pc-monitor": { title: "PC Gamer + Monitor", sub: "Kits e combinações compradas separadamente, com custo total.", placeholder: "Ex.: RTX 5060, i5 12400F…" },
  monitor: { title: "Monitor", sub: "Monitores gamer e convencionais.", placeholder: "Ex.: 27 QHD 180Hz IPS…" },
};

const STORE_SLUG: Record<string, string> = { "KaBuM!": "kabum", "Mercado Livre": "mercadolivre", "Amazon Brasil": "amazon-br", Shopee: "shopee", AliExpress: "aliexpress" };
const slugOf = (name: string) => STORE_SLUG[name] ?? name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const FILTER_KEYS = ["garimpo", "cond", "uf", "seller", "pickup", "q", "minPrice", "maxPrice", "cpu", "gpu", "minRam", "minStorage", "brand", "stores", "freeShipping", "origin", "maxDays", "resolution", "minRefresh", "minScore", "kit", "unconfirmed", "sort", "page"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

export function SearchView() {
  const { modo } = useParams<{ modo: string }>();
  const mode: SearchMode = modo === "monitor" || modo === "pc-monitor" ? modo : "pc";
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
    fetch(`/api/search?${qs}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((d: Resp) => {
        setData(d);
        setLoading(false);
      })
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
        <SearchBox initial={filters.q ?? ""} placeholder={t.placeholder} onSubmit={(q) => setFilter({ q })} />
      </div>

      {mode !== "pc-monitor" && (
        <button type="button" onClick={() => setFilter({ garimpo: filters.garimpo ? null : "1", sort: filters.garimpo ? null : "discount" })}
          className={`w-full mb-4 text-left rounded-xl border p-4 transition-colors ${filters.garimpo ? "border-accent bg-accent/10" : "border-line hover:border-accent/50"}`}>
          <span className="font-bold tracking-wide text-accent">GARIMPO EXTREMO {filters.garimpo ? "· ativo" : ""}</span>
          <span className="block text-xs text-muted mt-1">Só anúncios pelo menos 20% abaixo da média de anúncios comparáveis no mesmo estado (novos, usados, seminovos, recondicionados), com dados suficientes e sem alto risco. Máquinas obsoletas ficam de fora.</span>
        </button>
      )}
      <SourcesStrip data={data} loading={loading} onRefresh={() => setRefreshTick((x) => x + 1)} />

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
              <select className="input !w-auto" value={filters.sort ?? "score"} onChange={(e) => setFilter({ sort: e.target.value === "score" ? null : e.target.value })} aria-label="Ordenar">
                <option value="score">Melhor nota</option>
                <option value="price">Menor custo final</option>
                <option value="performance">{mode === "monitor" ? "Melhor qualidade" : "Maior desempenho"}</option>
                <option value="delivery">Entrega mais rápida</option>
                <option value="discount">Maior desconto real</option>
                <option value="value">Melhor custo-benefício</option>
              </select>
            )}
          </div>

          {data?.error && <div className="card p-6 text-bad text-sm">Erro ao buscar: {data.error}</div>}
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

function SearchBox({ initial, placeholder, onSubmit }: { initial: string; placeholder: string; onSubmit: (q: string) => void }) {
  const [q, setQ] = useState(initial);
  return (
    <form className="flex gap-2 w-full sm:w-96" onSubmit={(e) => { e.preventDefault(); onSubmit(q.trim()); }}>
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label="Buscar" />
      <button className="btn btn-primary">Buscar</button>
    </form>
  );
}

function SourcesStrip({ data, loading, onRefresh }: { data: Resp | null; loading: boolean; onRefresh: () => void }) {
  if (!data?.sources?.length && !loading) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-faint">Fontes consultadas:</span>
      {loading && !data && <span className="chip">consultando…</span>}
      {data?.sources?.filter((s, i, arr) => arr.findIndex((x) => x.source === s.source) === i).map((s) => {
        const runs = data.sources.filter((x) => x.source === s.source);
        const err = runs.find((r) => r.status === "error");
        const items = runs.reduce((n, r) => n + r.items, 0);
        return (
          <span key={s.source} className={`chip ${err ? "!text-bad !border-bad/40" : "!text-good !border-good/30"}`} title={err?.error}>
            {s.name.split(" (")[0]} · {err ? "erro" : runs.every((r) => r.status === "cached") ? "dados recentes" : `${items} novas`}
          </span>
        );
      })}
      <button className="text-accent hover:underline disabled:opacity-50" disabled={loading} onClick={onRefresh}>atualizar agora</button>
    </div>
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
