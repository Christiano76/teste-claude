import { writeFileSync } from "fs";
import { pool } from "../src/lib/db";
import { findOffers } from "../src/lib/search/repository";
import { analyzeOffers, buildCombos, dedupe, deliveryTier, isGarimpo, marketCurve, radar } from "../src/lib/search/service";
import { CONNECTORS, UNSUPPORTED_STORES } from "../src/lib/connectors/registry";
import { query } from "../src/lib/db";
import type { AnalyzedOffer } from "../src/lib/types";

const out = process.argv[2];
function slim(a: AnalyzedOffer) {
  const o = a.offer, x = a.analysis, p = o.specs.pc, m = o.specs.monitor;
  return {
    id: o.id, t: o.title, u: o.url, img: o.imageUrl, c: o.category, st: o.storeName, se: o.isMarketplace && o.sellerName !== o.storeName ? o.sellerName : null,
    br: o.brand, pr: o.price, ip: o.installmentPrice, lp: o.listPrice, fs: o.freeShipping, stock: o.stockQty, w: o.warrantyText, org: o.origin,
    loc: o.sellerLocation ? o.sellerLocation.toUpperCase() : null, sty: o.sellerType, pick: o.pickup, chk: o.lastCheckedAt,
    s: x.score, v: x.verdict, total: x.cost.total, complete: x.cost.totalIsComplete, notes: x.cost.notes,
    cond: x.condition, sc: x.scores, sn: x.scoreNotes, risk: x.risk.level, rr: x.risk.reasons,
    mk: { p: x.market.price, np: x.market.newPrice, n: x.market.comparables, b: x.market.basis, d: x.market.discount, sv: x.market.savings },
    gar: isGarimpo(a),
    tier: deliveryTier(a),
    dl: { m: x.delivery.mode, ok: x.delivery.deliverable, l: x.delivery.label, pg: x.delivery.program, pt: x.delivery.protection },
    ship: o.shipAvailable, scope: o.shipScope,
    ver: o.verification, psrc: o.priceSource, idx: o.indexedAt, plat: o.platform,
    use: x.usage?.map((u) => [u.use, u.level, u.note]) ?? null,
    part: o.specs.part ? { k: o.specs.part.kind, m: o.specs.part.model } : null,
    near: !!x.delivery.nearBuyer,
    comp: x.components.map((k) => [k.label, k.weight, k.value, k.detail]),
    flags: x.flags.map((f) => [f.level, f.message]),
    perf: x.performance ? { gi: x.performance.gamingIndex, tier: x.performance.tierLabel, res: x.performance.perResolution, bn: x.performance.bottleneck } : null,
    mq: x.monitorQuality, rep: [x.storeReputation.score, x.storeReputation.label],
    hist: x.priceInsight?.message ?? null, fake: !!x.priceInsight?.fakeDiscount,
    pc: p ? { cpu: p.cpu?.model ?? null, sock: p.cpu?.socket ?? null, gpu: p.gpu?.model ?? null, vram: p.gpu?.vramGb ?? null, ram: p.ramGb, rt: p.ramType, sto: p.storage, psu: p.psu, mb: p.motherboard, os: p.os, kit: p.includesMonitor } : null,
    mon: m ? { size: m.sizeIn, w: m.width, h: m.height, res: m.resolutionLabel, hz: m.refreshHz, panel: m.panel, ms: m.responseMs, sync: m.adaptiveSync, hdr: m.hdr, ports: m.ports } : null,
    also: a.alsoAt.length,
  };
}
(async () => {
  const loc0 = { cep: "71572811", uf: "DF", city: "Brasília", source: "viacep" };
  const both0 = async (category: "pc" | "monitor") => {
    const [c, i] = await Promise.all([findOffers({ category, limit: 3000, verification: "api" }), findOffers({ category, limit: 1500, verification: "indice-busca" })]);
    return dedupe(await analyzeOffers([...c, ...i], loc0)).filter((a) => !a.analysis.flags.some((f) => f.code === "defect")).sort((a, b) => b.analysis.score - a.analysis.score);
  };
  const pcs = await both0("pc");
  const mons = await both0("monitor");
  const loc = { cep: "71572811", uf: "DF", city: "Brasília", source: "viacep" };
  const both = async (category: "pc" | "monitor" | "kit" | "peca") => {
    const [c, i] = await Promise.all([findOffers({ category, limit: 3000, verification: "api" }), findOffers({ category, limit: 1500, verification: "indice-busca" })]);
    return dedupe(await analyzeOffers([...c, ...i], loc)).filter((a) => !a.analysis.flags.some((f) => f.code === "defect")).sort((a, b) => b.analysis.score - a.analysis.score);
  };
  const kits = await both("kit");
  const pecas = await both("peca");
  const listings = await query<{ url: string; platform: string; title: string; category: string; location: string | null; indexed_at: Date | null }>(
    "SELECT url, platform, title, category, location, indexed_at FROM discovered_listings WHERE last_seen_at > now() - interval '3 days' ORDER BY last_seen_at DESC LIMIT 400");
  const per = await query<{ source: string; active: string; used: string; ship: string; last_seen: Date | null }>(
    `SELECT source, count(*) FILTER (WHERE active AND available IS NOT FALSE) AS active,
       count(*) FILTER (WHERE active AND available IS NOT FALSE AND condition IN ('usado','seminovo','recondicionado','mostruario')) AS used,
       count(*) FILTER (WHERE active AND available IS NOT FALSE AND ship_available IS TRUE) AS ship, max(last_seen_at) AS last_seen FROM offers GROUP BY source`);
  const errs = await query<{ source: string; error: string; finished_at: Date }>(`SELECT DISTINCT ON (source) source, error, finished_at FROM search_runs WHERE status='error' ORDER BY source, started_at DESC`);
  const runs = await query<{ source: string; status: string }>(`SELECT DISTINCT ON (source) source, status FROM search_runs WHERE status <> 'running' ORDER BY source, started_at DESC`);
  const sources = CONNECTORS.map((c) => {
    const st = c.status();
    const p = per.filter((r) => r.source === c.id || (c.id === "feeds" && r.source.startsWith("feed:")));
    const listings = p.reduce((n, r) => n + Number(r.active), 0);
    const last = runs.find((r) => r.source === c.id);
    const e = errs.find((r) => r.source === c.id);
    return {
      name: c.name, kind: c.kind, msg: st.message, req: st.requires, conf: st.configured, ev: c.evidence ?? null, docs: st.docsUrl,
      real: st.configured && last?.status === "ok" && listings > 0 ? "funcionando" : st.state === "unavailable" ? "sem-integracao" : !st.configured ? "requer-credenciais" : "sem-dados",
      n: listings, used: p.reduce((n, r) => n + Number(r.used), 0), ship: p.reduce((n, r) => n + Number(r.ship), 0),
      upd: p.map((r) => r.last_seen).filter(Boolean).sort().pop() ?? null, err: e ? { m: e.error, at: e.finished_at } : null,
    };
  });
  const { combos, kitInsight } = buildCombos(pcs, mons);
  const [pcC, monC] = [await marketCurve("pc"), await marketCurve("monitor")];
  const r = await radar(48);
  const known = new Set([...pcs, ...mons, ...kits, ...pecas].map((a) => a.offer.id));
  const data = {
    at: new Date().toISOString(), pcCurveN: pcC.n, monCurveN: monC.n,
    pcs: pcs.map(slim), mons: mons.map(slim), kits: kits.map(slim), pecas: pecas.map(slim), listings: listings.map((l) => ({ u: l.url, p: l.platform, t: l.title, c: l.category, loc: l.location })), kitInsight, sources, unsupported: UNSUPPORTED_STORES,
    combos: combos.slice(0, 60).map((c) => ({ kind: c.kind, pc: c.pc.offer.id, mon: c.monitor?.offer.id ?? null, total: c.total, complete: c.totalIsComplete, s: c.score, v: c.verdict, notes: c.matchNotes })),
    radar: {
      drops: r.priceDrops.filter((d) => known.has(d.item.offer.id)).map((d) => ({ id: d.item.offer.id, prev: d.previous, cur: d.current, at: d.at })),
      fresh: r.newListings.map((a) => a!.offer.id).filter((id) => known.has(id)),
      removed: r.removed.length,
    },
  };
  writeFileSync(`${out}/data.json`, JSON.stringify(data));
  console.log("kits", kits.length, "tiers", JSON.stringify([...data.pcs, ...data.mons, ...data.kits].reduce((m: Record<string, number>, x) => (x.tier ? ((m[x.tier] = (m[x.tier] ?? 0) + 1), m) : m), {})));
  console.log("pcs", pcs.length, "mons", mons.length, "combos", data.combos.length, "garimpo", [...data.pcs, ...data.mons, ...data.kits].filter((x) => x.gar).length, "drops", data.radar.drops.length, "KB", Math.round(JSON.stringify(data).length / 1024));
  await pool().end();
})();
