import { writeFileSync } from "fs";
import { pool } from "../src/lib/db";
import { findOffers } from "../src/lib/search/repository";
import { analyzeOffers, buildCombos, dedupe, isGarimpo, marketCurve, radar } from "../src/lib/search/service";
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
  const pcs = dedupe(await analyzeOffers(await findOffers({ category: "pc", limit: 3000 }), null)).sort((a, b) => b.analysis.score - a.analysis.score);
  const mons = dedupe(await analyzeOffers(await findOffers({ category: "monitor", limit: 3000 }), null)).sort((a, b) => b.analysis.score - a.analysis.score);
  const { combos, kitInsight } = buildCombos(pcs, mons);
  const [pcC, monC] = [await marketCurve("pc"), await marketCurve("monitor")];
  const r = await radar(48);
  const known = new Set([...pcs, ...mons].map((a) => a.offer.id));
  const data = {
    at: new Date().toISOString(), pcCurveN: pcC.n, monCurveN: monC.n,
    pcs: pcs.map(slim), mons: mons.map(slim), kitInsight,
    combos: combos.slice(0, 60).map((c) => ({ kind: c.kind, pc: c.pc.offer.id, mon: c.monitor?.offer.id ?? null, total: c.total, complete: c.totalIsComplete, s: c.score, v: c.verdict, notes: c.matchNotes })),
    radar: {
      drops: r.priceDrops.filter((d) => known.has(d.item.offer.id)).map((d) => ({ id: d.item.offer.id, prev: d.previous, cur: d.current, at: d.at })),
      fresh: r.newListings.map((a) => a!.offer.id).filter((id) => known.has(id)),
      removed: r.removed.length,
    },
  };
  writeFileSync(`${out}/data.json`, JSON.stringify(data));
  console.log("pcs", pcs.length, "mons", mons.length, "combos", data.combos.length, "garimpo", data.pcs.filter((x) => x.gar).length + data.mons.filter((x) => x.gar).length, "drops", data.radar.drops.length, "KB", Math.round(JSON.stringify(data).length / 1024));
  await pool().end();
})();
