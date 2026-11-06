import { config } from "../config";
import { connectorById } from "../connectors/registry";
import { query } from "../db";
import { lookupCep } from "../geo/cep";
import { pcPerformance, monitorQuality, pairingNotes } from "../hardware/performance";
import { getHistories, priceInsight } from "../history/service";
import { usdBrl } from "../pricing/fx";
import { fitCurve, REFERENCE, type MarketCurve } from "../scoring/market";
import type { StoreRow } from "../scoring/reputation";
import { analyzeOffer, verdictOf, type ScoreContext } from "../scoring/score";
import type { AnalyzedOffer, Category, ComboResult, Offer, SearchMode, UserLocation } from "../types";
import { collect, type SourceRun } from "./collect";
import { findOffers, marketPoints, type OfferFilters } from "./repository";

const curveCache = new Map<Category, { at: number; curve: MarketCurve }>();

export async function marketCurve(category: Category): Promise<MarketCurve> {
  const hit = curveCache.get(category);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.curve;
  const pts = await marketPoints(category);
  const xy = pts.flatMap(({ specs, price }) => {
    if (category === "pc" && specs.pc && !specs.pc.includesMonitor) {
      const e = pcPerformance(specs.pc).gamingIndex;
      return e != null && specs.pc.cpu?.index != null ? [{ x: e, price }] : [];
    }
    if (category === "monitor" && specs.monitor?.resolutionLabel && specs.monitor.refreshHz) return [{ x: monitorQuality(specs.monitor), price }];
    return [];
  });
  const curve = fitCurve(xy, REFERENCE[category]);
  curveCache.set(category, { at: Date.now(), curve });
  return curve;
}

async function storesMap(): Promise<Map<string, StoreRow>> {
  const rows = await query<StoreRow>("SELECT slug, name, reputation, reputation_basis FROM stores");
  return new Map(rows.map((r) => [r.slug, r]));
}

function storeSlugOf(o: Offer, map: Map<string, StoreRow>): StoreRow | null {
  for (const s of map.values()) if (s.name === o.storeName) return s;
  return null;
}

interface QuoteRow { offer_id: string; cost: string | null; min_days: number | null; max_days: number | null; source: string }

/** Cotações de frete para o CEP: usa cache de 12 h e consulta fontes que oferecem cálculo (ex.: Mercado Livre). */
async function shippingQuotes(offers: Offer[], cep: string | null, liveLimit = 10): Promise<Map<number, QuoteRow>> {
  const out = new Map<number, QuoteRow>();
  if (!cep || !offers.length) return out;
  const rows = await query<QuoteRow>("SELECT offer_id, cost, min_days, max_days, source FROM shipping_quotes WHERE cep = $1 AND offer_id = ANY($2) AND quoted_at > now() - interval '12 hours'", [cep, offers.map((o) => o.id)]);
  for (const r of rows) out.set(Number(r.offer_id), r);
  const missing = offers.filter((o) => !out.has(o.id) && connectorById(o.source)?.shipping).slice(0, liveLimit);
  await Promise.all(missing.map(async (o) => {
    try {
      const q = await connectorById(o.source)!.shipping!(o.externalId, cep);
      if (!q) return;
      const row: QuoteRow = { offer_id: String(o.id), cost: q.cost == null ? null : String(q.cost), min_days: q.delivery?.minDays ?? null, max_days: q.delivery?.maxDays ?? null, source: q.delivery?.source ?? o.source };
      await query(
        `INSERT INTO shipping_quotes (offer_id, cep, cost, min_days, max_days, source) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (offer_id, cep) DO UPDATE SET cost=$3, min_days=$4, max_days=$5, source=$6, quoted_at=now()`,
        [o.id, cep, q.cost, row.min_days, row.max_days, row.source],
      );
      out.set(o.id, row);
    } catch {
      /* cotação indisponível: segue sem */
    }
  }));
  return out;
}

export async function analyzeOffers(offers: Offer[], location: UserLocation | null): Promise<AnalyzedOffer[]> {
  if (!offers.length) return [];
  const [stores, fx, pcCurve, monitorCurve, histories] = await Promise.all([
    storesMap(), usdBrl(), marketCurve("pc"), marketCurve("monitor"), getHistories(offers.map((o) => o.id)),
  ]);
  // ordem preliminar por preço para limitar cotações ao vivo às ofertas mais relevantes
  const quotes = await shippingQuotes(offers, location?.cep ?? null);
  return offers.map((o) => {
    const q = quotes.get(o.id);
    const ctx: ScoreContext = {
      store: storeSlugOf(o, stores),
      usdRate: fx?.rate ?? null,
      icmsRate: config.importIcmsRate,
      pcCurve,
      monitorCurve,
      priceInsight: priceInsight(histories.get(o.id) ?? [], o.price, o.listPrice),
      shippingQuote: q ? { cost: q.cost == null ? null : Number(q.cost), minDays: q.min_days, maxDays: q.max_days, source: q.source } : null,
    };
    return { offer: o, analysis: analyzeOffer(o, ctx), alsoAt: [] };
  });
}

/** Remove duplicados (mesmo produto/configuração na mesma loja) e agrupa a mesma configuração em outras lojas. */
export function dedupe(items: AnalyzedOffer[]): AnalyzedOffer[] {
  const specific = (k: string) => !k.includes(":?:") && !k.endsWith(":?") && !/não informad/.test(k);
  const byStore = new Map<string, AnalyzedOffer>();
  for (const it of items) {
    const key = specific(it.offer.canonicalKey) ? `${it.offer.canonicalKey}|${it.offer.storeName}|${it.offer.sellerName ?? ""}` : `id:${it.offer.id}`;
    const prev = byStore.get(key);
    if (!prev || it.analysis.cost.total < prev.analysis.cost.total) byStore.set(key, it);
  }
  const groups = new Map<string, AnalyzedOffer[]>();
  for (const it of byStore.values()) {
    const k = specific(it.offer.canonicalKey) ? it.offer.canonicalKey : `id:${it.offer.id}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(it);
  }
  const out: AnalyzedOffer[] = [];
  for (const g of groups.values()) {
    g.sort((a, b) => b.analysis.score - a.analysis.score || a.analysis.cost.total - b.analysis.cost.total);
    const [best, ...rest] = g;
    best.alsoAt = rest.slice(0, 5).map((r) => ({ store: r.offer.sellerName && r.offer.isMarketplace ? `${r.offer.storeName} · ${r.offer.sellerName}` : r.offer.storeName, price: r.analysis.cost.total, offerId: r.offer.id }));
    out.push(best);
  }
  return out;
}

export interface SearchRequest extends Omit<OfferFilters, "category"> {
  mode: SearchMode;
  cep?: string;
  sort?: "score" | "price" | "performance" | "delivery";
  page?: number;
  pageSize?: number;
  refresh?: boolean;
  minScore?: number;
}

export interface Facets {
  stores: { value: string; label: string; count: number }[];
  brands: { value: string; count: number }[];
  cpus: { value: string; count: number }[];
  gpus: { value: string; count: number }[];
  resolutions: { value: string; count: number }[];
}

export interface SearchResponse {
  mode: SearchMode;
  location: UserLocation | null;
  sources: SourceRun[];
  total: number;
  page: number;
  pageSize: number;
  results: AnalyzedOffer[];
  combos?: ComboResult[];
  kitInsight?: string | null;
  facets: Facets;
  market: { pc: MarketCurve; monitor: MarketCurve };
  generatedAt: string;
}

function facetCount<T>(items: T[], key: (t: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    if (k) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([value, count]) => ({ value, count }));
}

function sortItems(items: AnalyzedOffer[], sort: SearchRequest["sort"]) {
  const perf = (x: AnalyzedOffer) => x.analysis.performance?.gamingIndex ?? x.analysis.monitorQuality ?? 0;
  const days = (x: AnalyzedOffer) => x.offer.delivery?.maxDays ?? (x.offer.origin === "INTL" ? 99 : 50);
  items.sort((a, b) => {
    if (sort === "price") return a.analysis.cost.total - b.analysis.cost.total;
    if (sort === "performance") return perf(b) - perf(a) || b.analysis.score - a.analysis.score;
    if (sort === "delivery") return days(a) - days(b) || b.analysis.score - a.analysis.score;
    return b.analysis.score - a.analysis.score || a.analysis.cost.total - b.analysis.cost.total;
  });
}

async function searchCategory(category: Category, req: SearchRequest, location: UserLocation | null) {
  const offers = await findOffers({ ...req, category, text: req.text, includesMonitor: category === "pc" ? req.includesMonitor : undefined });
  const analyzed = dedupe(await analyzeOffers(offers, location));
  return analyzed.filter((a) => (req.minScore == null || a.analysis.score >= req.minScore) && (req.maxDeliveryDays == null || (a.offer.delivery?.maxDays ?? 999) <= req.maxDeliveryDays));
}

export async function search(req: SearchRequest): Promise<SearchResponse> {
  const location = req.cep ? await lookupCep(req.cep) : null;
  const page = Math.max(1, req.page ?? 1);
  const pageSize = Math.min(60, Math.max(6, req.pageSize ?? 24));
  const categories: Category[] = req.mode === "monitor" ? ["monitor"] : req.mode === "pc" ? ["pc"] : ["pc", "monitor"];

  // 1) coleta nas fontes (sob demanda, com cache)
  const sources: SourceRun[] = [];
  for (const c of categories) {
    const q = req.mode === "pc-monitor" && c === "monitor" ? "" : req.text ?? "";
    sources.push(...(await collect(c, q, { force: req.refresh })));
  }

  // 2) análise
  let results: AnalyzedOffer[];
  let combos: ComboResult[] | undefined;
  let kitInsight: string | null | undefined;
  if (req.mode === "pc-monitor") {
    const pcs = await searchCategory("pc", { ...req, maxPrice: undefined, resolution: undefined, minRefresh: undefined }, location);
    const monitors = await searchCategory("monitor", { ...req, text: "", cpu: undefined, gpu: undefined, minRam: undefined, minStorage: undefined, maxPrice: undefined, brand: undefined }, location);
    ({ combos, kitInsight } = buildCombos(pcs, monitors, req.maxPrice, req.minPrice));
    results = [];
  } else {
    results = await searchCategory(categories[0], req, location);
    sortItems(results, req.sort);
  }

  const all = results.length ? results : [];
  const facets: Facets = {
    stores: facetCount(all, (a) => a.offer.storeName).map((f) => ({ value: f.value, label: f.value, count: f.count })),
    brands: facetCount(all, (a) => a.offer.brand),
    cpus: facetCount(all, (a) => a.offer.specs.pc?.cpu?.model.replace(/\s*\(.*\)$/, "")),
    gpus: facetCount(all, (a) => a.offer.specs.pc?.gpu?.model.replace(/\s*\(.*\)$/, "")),
    resolutions: facetCount(all, (a) => a.offer.specs.monitor?.resolutionLabel),
  };
  const [pcC, monC] = await Promise.all([marketCurve("pc"), marketCurve("monitor")]);
  return {
    mode: req.mode,
    location,
    sources,
    total: combos ? combos.length : results.length,
    page,
    pageSize,
    results: results.slice((page - 1) * pageSize, page * pageSize),
    combos: combos?.slice((page - 1) * pageSize, page * pageSize),
    kitInsight,
    facets,
    market: { pc: pcC, monitor: monC },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Monta conjuntos PC + monitor: kits (monitor incluso) e combinações compradas separadamente.
 * Compara se comprar separado compensa mais que o kit.
 */
export function buildCombos(pcs: AnalyzedOffer[], monitors: AnalyzedOffer[], maxBudget?: number, minBudget?: number): { combos: ComboResult[]; kitInsight: string | null } {
  const combos: ComboResult[] = [];
  const kits = pcs.filter((p) => p.offer.specs.pc?.includesMonitor);
  for (const k of kits) {
    combos.push({ kind: "kit", pc: k, monitor: null, total: k.analysis.cost.total, totalIsComplete: k.analysis.cost.totalIsComplete, score: k.analysis.score, verdict: k.analysis.verdict, matchNotes: k.offer.specs.pc?.monitor ? pairingNotes(k.analysis.performance?.gamingIndex ?? null, k.offer.specs.pc.monitor).notes : ["Monitor incluso (especificações não detalhadas)."] });
  }
  const pcOnly = pcs.filter((p) => !p.offer.specs.pc?.includesMonitor && !p.analysis.suspicious).sort((a, b) => b.analysis.score - a.analysis.score).slice(0, 30);
  const mons = monitors.filter((m) => !m.analysis.suspicious).sort((a, b) => b.analysis.score - a.analysis.score).slice(0, 30);
  for (const p of pcOnly) {
    let best: ComboResult | null = null;
    for (const m of mons) {
      const fit = pairingNotes(p.analysis.performance?.gamingIndex ?? null, m.offer.specs.monitor!);
      const total = Math.round((p.analysis.cost.total + m.analysis.cost.total) * 100) / 100;
      if (maxBudget != null && total > maxBudget) continue;
      if (minBudget != null && total < minBudget) continue;
      const score = Math.round((0.62 * p.analysis.score + 0.38 * m.analysis.score) * fit.fit);
      const c: ComboResult = { kind: "separado", pc: p, monitor: m, total, totalIsComplete: p.analysis.cost.totalIsComplete && m.analysis.cost.totalIsComplete, score, verdict: verdictOf(score), matchNotes: fit.notes };
      if (!best || c.score > best.score || (c.score === best.score && c.total < best.total)) best = c;
    }
    if (best) combos.push(best);
  }
  const inBudget = combos.filter((c) => (maxBudget == null || c.total <= maxBudget) && (minBudget == null || c.total >= minBudget));
  inBudget.sort((a, b) => b.score - a.score || a.total - b.total);
  // diversidade: o mesmo monitor aparece no máximo 3 vezes
  const monitorUse = new Map<number, number>();
  const filtered = inBudget.filter((c) => {
    if (!c.monitor) return true;
    const n = monitorUse.get(c.monitor.offer.id) ?? 0;
    monitorUse.set(c.monitor.offer.id, n + 1);
    return n < 3;
  });

  // Kit vs separado: para o melhor kit, existe combinação separada com desempenho ≥ e preço menor?
  let kitInsight: string | null = null;
  const bestKit = filtered.find((c) => c.kind === "kit");
  if (bestKit) {
    const kitPerf = bestKit.pc.analysis.performance?.gamingIndex ?? 0;
    const kitMonQ = bestKit.pc.analysis.monitorQuality ?? 0;
    const alt = filtered
      .filter((c) => c.kind === "separado" && (c.pc.analysis.performance?.gamingIndex ?? 0) >= kitPerf && (c.monitor?.analysis.monitorQuality ?? 0) >= kitMonQ)
      .sort((a, b) => a.total - b.total)[0];
    if (alt && alt.total < bestKit.total) {
      kitInsight = `Comprar separado compensa: PC + monitor com desempenho igual ou melhor que o kit mais bem avaliado sai R$ ${(bestKit.total - alt.total).toFixed(2)} mais barato.`;
    } else if (alt) {
      kitInsight = `O kit mais bem avaliado é R$ ${(alt.total - bestKit.total).toFixed(2)} mais barato que montar um conjunto equivalente separadamente.`;
    } else {
      kitInsight = "Não encontramos combinação separada equivalente ao melhor kit para comparar.";
    }
  } else if (filtered.length) {
    kitInsight = "Nenhum kit PC + monitor encontrado nas fontes ativas — exibindo combinações compradas separadamente.";
  }
  return { combos: filtered, kitInsight };
}
