import { connection } from "next/server";
import { fail, ok } from "@/lib/api";
import { CONNECTORS, UNSUPPORTED_STORES } from "@/lib/connectors/registry";
import { query } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    const runs = await query<{ source: string; status: string; items: number; error: string | null; finished_at: Date | null; trigger: string }>(
      `SELECT DISTINCT ON (source) source, status, items, error, finished_at, trigger FROM search_runs WHERE status <> 'running' ORDER BY source, started_at DESC`,
    );
    const okRuns = await query<{ source: string; last_ok: Date; items_24h: string }>(
      `SELECT source, max(finished_at) AS last_ok, sum(items) FILTER (WHERE finished_at > now() - interval '24 hours') AS items_24h FROM search_runs WHERE status='ok' GROUP BY source`,
    );
    const stats = await query<{ category: string; offers: string; stores: string; snapshots: string }>(
      `SELECT category, count(*) AS offers, count(DISTINCT store_slug) AS stores, 0 AS snapshots FROM offers WHERE active GROUP BY category`,
    );
    const perSource = await query<{ source: string; active: string; used: string; ship: string; last_seen: Date | null }>(
      `SELECT source, count(*) FILTER (WHERE active AND available IS NOT FALSE) AS active,
              count(*) FILTER (WHERE active AND available IS NOT FALSE AND condition IN ('usado','seminovo','recondicionado','mostruario')) AS used,
              count(*) FILTER (WHERE active AND available IS NOT FALSE AND ship_available IS TRUE) AS ship,
              max(last_seen_at) AS last_seen
       FROM offers GROUP BY source`,
    );
    const lastErr = await query<{ source: string; error: string; finished_at: Date }>(
      `SELECT DISTINCT ON (source) source, error, finished_at FROM search_runs WHERE status = 'error' ORDER BY source, started_at DESC`,
    );
    const [snap] = await query<{ n: string; oldest: Date | null }>("SELECT count(*) AS n, min(captured_at) AS oldest FROM price_snapshots");
    const stores = await query<{ slug: string; name: string; reputation: number | null; discovered_via: string; offers: string }>(
      `SELECT s.slug, s.name, s.reputation, s.discovered_via, count(o.id) AS offers FROM stores s LEFT JOIN offers o ON o.store_slug = s.slug AND o.active GROUP BY s.slug ORDER BY count(o.id) DESC, s.name`,
    );
    return ok({
      connectors: CONNECTORS.map((c) => {
        const last = runs.find((r) => r.source === c.id || (c.id === "feeds" && r.source.startsWith("feed")));
        const lastOk = okRuns.find((r) => r.source === c.id);
        const match = (src: string) => src === c.id || (c.id === "feeds" && src.startsWith("feed:"));
        const counts = perSource.filter((p) => match(p.source));
        const err = lastErr.filter((e) => match(e.source)).sort((a, b) => +b.finished_at - +a.finished_at)[0];
        const st = c.status();
        const listings = counts.reduce((n, p) => n + Number(p.active), 0);
        // "funcionando" só com busca real bem-sucedida e anúncios na base
        const works = st.configured && last?.status === "ok" && listings > 0;
        return {
          id: c.id, name: c.name, kind: c.kind, stores: c.stores, ...st, evidence: c.evidence ?? null,
          realStatus: works ? "funcionando" : st.state === "unavailable" ? "sem-integracao" : !st.configured ? "requer-credenciais" : last?.status === "error" ? "erro" : "sem-dados",
          listings, usedListings: counts.reduce((n, p) => n + Number(p.used), 0), shippingConfirmed: counts.reduce((n, p) => n + Number(p.ship), 0),
          lastUpdate: counts.map((p) => p.last_seen).filter(Boolean).sort().pop() ?? null,
          lastError: err ? { message: err.error, at: err.finished_at } : null,
          lastRun: last ?? null, lastOk: lastOk?.last_ok ?? null, items24h: Number(lastOk?.items_24h ?? 0),
        };
      }),
      unsupported: UNSUPPORTED_STORES,
      stats: {
        offers: Object.fromEntries(stats.map((s) => [s.category, Number(s.offers)])),
        snapshots: Number(snap.n),
        historySince: snap.oldest,
      },
      stores: stores.map((s) => ({ ...s, offers: Number(s.offers) })),
      auxiliary: [
        { name: "ViaCEP / BrasilAPI", purpose: "Localização do CEP (UF/cidade) para impostos e cotação de frete", state: "ok" },
        { name: "Banco Central (PTAX)", purpose: "Cotação do dólar para produtos internacionais", state: "ok" },
        { name: "Resend (e-mail)", purpose: "Envio de alertas por e-mail", state: process.env.RESEND_API_KEY ? "unverified" : "needs-credentials" },
      ],
    });
  } catch (e) {
    return fail(e);
  }
}
