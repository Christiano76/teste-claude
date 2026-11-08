import { config } from "../config";
import { query } from "../db";
import { activeConnectors, connectorById } from "../connectors/registry";
import type { Connector } from "../connectors/types";
import type { Category } from "../types";
import { normalize } from "../util/text";
import { getOffer, prepare, updateDetails, upsertOffers } from "./repository";

export interface SourceRun {
  source: string;
  name: string;
  status: "ok" | "cached" | "error";
  items: number;
  error?: string;
}

async function recentRun(source: string, category: Category, q: string, minutes: number): Promise<boolean> {
  const r = await query(
    `SELECT 1 FROM search_runs WHERE source=$1 AND category=$2 AND query=$3 AND status='ok' AND finished_at > now() - ($4 || ' minutes')::interval LIMIT 1`,
    [source, category, q, String(minutes)],
  );
  return r.length > 0;
}

async function runOne(c: Connector, category: Category, q: string, pages: number, trigger: string, timeoutMs: number, ctx: { maxPrice?: number; uf?: string | null; rawQuery: string }): Promise<SourceRun> {
  const [run] = await query<{ id: string }>("INSERT INTO search_runs (source, query, category, trigger) VALUES ($1,$2,$3,$4) RETURNING id", [c.id, q, category, trigger]);
  let items = 0;
  const deadline = Date.now() + timeoutMs;
  try {
    for (let page = 1; page <= pages && Date.now() < deadline; page++) {
      const res = await c.search({ category, query: ctx.rawQuery, page, pageSize: 100, maxPrice: ctx.maxPrice, uf: ctx.uf });
      // cada anúncio vai para a categoria detectada (uma busca de PC pode trazer monitores, kits e peças)
      const byCat = new Map<Category, NonNullable<ReturnType<typeof prepare>>[]>();
      for (const o of res.offers) {
        const cat = o.categoryHint ?? category;
        const pr = prepare(o, cat);
        if (!pr) continue;
        if (!byCat.has(cat)) byCat.set(cat, []);
        byCat.get(cat)!.push(pr);
      }
      for (const [cat, list] of byCat) await upsertOffers(list, cat);
      items += [...byCat.values()].reduce((n, l) => n + l.length, 0);
      if (!res.hasMore) break;
    }
    await query("UPDATE search_runs SET status='ok', finished_at=now(), items=$2 WHERE id=$1", [run.id, items]);
    return { source: c.id, name: c.name, status: "ok", items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await query("UPDATE search_runs SET status='error', finished_at=now(), items=$2, error=$3 WHERE id=$1", [run.id, items, msg.slice(0, 500)]);
    return { source: c.id, name: c.name, status: "error", items, error: msg };
  }
}

/** Consulta as fontes ativas (em paralelo), reaproveitando coletas recentes. */
export async function collect(category: Category, rawQuery: string, opts: { pages?: number; trigger?: string; force?: boolean; timeoutMs?: number; maxPrice?: number; uf?: string | null; only?: string[] } = {}): Promise<SourceRun[]> {
  // chave de cache inclui UF e faixa de orçamento (consultas regionais e "barato" mudam o resultado)
  const q = `${normalize(rawQuery)}|${opts.uf ?? ""}|${opts.maxPrice != null && opts.maxPrice <= 1200 ? "b" : ""}`;
  const pages = opts.pages ?? config.onDemandPages;
  const out = await Promise.all(
    activeConnectors().filter((c) => !opts.only?.length || opts.only.includes(c.id)).map(async (c) => {
      if (!opts.force && (await recentRun(c.id, category, q, config.searchCacheMinutes))) {
        return { source: c.id, name: c.name, status: "cached" as const, items: 0 };
      }
      return runOne(c, category, q, c.kind === "search-index" ? 1 : pages, opts.trigger ?? "on-demand", opts.timeoutMs ?? 20000, { maxPrice: opts.maxPrice, uf: opts.uf, rawQuery });
    }),
  );
  return out;
}

/** Busca a ficha técnica completa (fonte, placa-mãe etc.) de uma oferta, se a fonte permitir. */
export async function enrichOffer(id: number): Promise<boolean> {
  const o = await getOffer(id);
  if (!o) return false;
  const c = connectorById(o.source);
  if (!c?.details) return false;
  const d = await c.details(o.externalId);
  if (!d) return false;
  await updateDetails(id, d.specsText ?? null, d.warrantyText ?? null, o.category, o.title, o.brand);
  return true;
}

export async function offersNeedingDetails(limit: number): Promise<number[]> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM offers WHERE active AND available AND details_fetched_at IS NULL AND source = 'kabum'
     ORDER BY (category='pc') DESC, last_seen_at DESC LIMIT $1`,
    [limit],
  );
  return rows.map((r) => Number(r.id));
}
