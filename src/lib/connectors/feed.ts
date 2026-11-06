/**
 * Feeds de produtos — formato Google Merchant Center (RSS/Atom XML), CSV/TSV ou JSON.
 * Permite incluir lojas que oferecem feed via programas de afiliados (Awin, Lomadee,
 * Rakuten, Afilio etc.) ou diretamente, sem raspar páginas protegidas.
 *
 * PRODUCT_FEEDS='[{"store":"Pichau","url":"https://.../feed.xml","origin":"BR"}]'
 * URLs file:// são aceitas (útil para testes e importações manuais).
 */
import { readFile } from "fs/promises";
import { config } from "../config";
import { classifyCondition } from "../market/condition";
import type { Category, RawOffer } from "../types";
import { fetchWithPolicy } from "../util/http";
import { normalize } from "../util/text";
import { isAccessory, detectCategory } from "../hardware/specs";
import { type Connector, defaultQuery, emptyOffer, type SearchPage, type SearchParams } from "./types";

export interface FeedConfig {
  store: string;
  url: string;
  origin?: "BR" | "INTL";
  /** "loja" (padrão, Google Merchant) ou "classificados" (anúncios de particulares/autorizados). */
  kind?: "loja" | "classificados";
}

export function feedConfigs(): FeedConfig[] {
  if (!config.connectors.feeds) return [];
  try {
    const arr = JSON.parse(config.connectors.feeds) as FeedConfig[];
    return Array.isArray(arr) ? arr.filter((f) => f.store && f.url) : [];
  } catch {
    return [];
  }
}

const feedCache = new Map<string, { at: number; items: RawOffer[] }>();

function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").trim();
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<(?:g:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:g:)?${name}>`, "i");
  const m = block.match(re);
  return m ? decode(m[1]) : null;
}

export function parsePrice(v: string | null | undefined): number | null {
  if (!v) return null;
  const m = v.replace(/[^\d.,]/g, "");
  if (!m) return null;
  // "1.234,56" (BR) ou "1234.56"
  const n = /,\d{1,2}$/.test(m) ? Number(m.replace(/\./g, "").replace(",", ".")) : Number(m.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface FeedRecord {
  id: string | null; title: string | null; link: string | null; price: string | null; sale_price: string | null;
  availability: string | null; image_link: string | null; brand: string | null; description: string | null;
  condition: string | null; shipping_price: string | null;
  // campos opcionais de classificados
  shipping_available?: string | null; shipping_scope?: string | null; shipping_program?: string | null; pickup?: string | null;
  protection?: string | null; seller_type?: string | null; seller_name?: string | null; location?: string | null;
}

/** "sim"/"true"/"1" → true; "não"/"false"/"0" → false; vazio → null (não confirmado). */
export function parseBool(v: string | null | undefined): boolean | null {
  if (v == null || v.trim() === "") return null;
  const t = v.trim().toLowerCase();
  if (["1", "true", "sim", "yes", "s"].includes(t)) return true;
  if (["0", "false", "nao", "não", "no", "n"].includes(t)) return false;
  return null;
}

function toOffer(r: FeedRecord, f: FeedConfig): RawOffer | null {
  const regular = parsePrice(r.price);
  const sale = parsePrice(r.sale_price);
  const price = sale ?? regular;
  if (!r.id || !r.title || !r.link || !price) return null;
  const av = r.availability?.toLowerCase().replace(/\s/g, "_") ?? null;
  return {
    ...emptyOffer({ source: `feed:${normalize(f.store)}`, externalId: r.id, title: r.title, url: r.link, price, storeName: f.store }),
    imageUrl: r.image_link,
    listPrice: sale && regular && regular > sale ? regular : null,
    available: av ? av === "in_stock" || av === "em_estoque" : null,
    brand: r.brand,
    specsText: r.description?.slice(0, 4000) ?? null,
    condition: classifyCondition(r.title, r.description, r.condition, { storeSellsNewByDefault: f.kind !== "classificados" }),
    sellerType: f.kind === "classificados" ? (r.seller_type === "pessoa-fisica" || r.seller_type === "profissional" ? r.seller_type : null) : "loja",
    sellerName: r.seller_name ?? null,
    sellerLocation: r.location ?? null,
    pickup: parseBool(r.pickup),
    // Envio só é considerado confirmado se o feed disser explicitamente (ou trouxer preço de frete)
    shipAvailable: parseBool(r.shipping_available) ?? (r.shipping_price ? true : null),
    shipScope: r.shipping_scope === "local" || r.shipping_scope === "nacional" || r.shipping_scope === "internacional" ? r.shipping_scope : null,
    shipProgram: r.shipping_program ?? null,
    protection: r.protection ?? null,
    shippingCost: parsePrice(r.shipping_price) ?? (r.shipping_price && /^0([.,]0+)?\b/.test(r.shipping_price) ? 0 : null),
    freeShipping: r.shipping_price ? parsePrice(r.shipping_price) == null && /^0/.test(r.shipping_price) : null,
    origin: f.origin ?? "BR",
    taxesIncluded: (f.origin ?? "BR") === "BR",
    isMarketplace: f.kind === "classificados",
  };
}

export function parseFeed(body: string, f: FeedConfig): RawOffer[] {
  const trimmed = body.trimStart();
  const records: FeedRecord[] = [];
  if (trimmed.startsWith("<")) {
    const blocks = body.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];
    for (const b of blocks) {
      const ship = b.match(/<g:shipping>[\s\S]*?<\/g:shipping>/i)?.[0] ?? "";
      records.push({
        id: tag(b, "id"), title: tag(b, "title"), link: tag(b, "link") ?? b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null,
        price: tag(b, "price"), sale_price: tag(b, "sale_price"), availability: tag(b, "availability"),
        image_link: tag(b, "image_link"), brand: tag(b, "brand"), description: tag(b, "description"),
        condition: tag(b, "condition"), shipping_price: ship ? tag(ship, "price") : null,
      });
    }
  } else if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const j = JSON.parse(body);
    const arr: Record<string, unknown>[] = Array.isArray(j) ? j : (j.products ?? j.items ?? []);
    for (const o of arr) {
      const s = (k: string) => (o[k] == null ? null : String(o[k]));
      records.push({ id: s("id"), title: s("title"), link: s("link") ?? s("url"), price: s("price"), sale_price: s("sale_price"), availability: s("availability"), image_link: s("image_link") ?? s("image"), brand: s("brand"), description: s("description"), condition: s("condition"), shipping_price: s("shipping_price"),
        shipping_available: s("shipping_available"), shipping_scope: s("shipping_scope"), shipping_program: s("shipping_program"), pickup: s("pickup"), protection: s("protection"), seller_type: s("seller_type"), seller_name: s("seller_name"), location: s("location") });
    }
  } else {
    const lines = body.split(/\r?\n/).filter(Boolean);
    const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
    const split = (l: string) => l.match(new RegExp(`("([^"]|"")*"|[^${sep}]*)(${sep}|$)`, "g"))!.slice(0, -1).map((c) => c.replace(new RegExp(`${sep}$`), "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    const head = split(lines[0]).map((h) => h.trim().toLowerCase().replace(/^g:/, ""));
    for (const l of lines.slice(1)) {
      const cols = split(l);
      const get = (k: string) => { const i = head.indexOf(k); return i >= 0 && cols[i] ? cols[i] : null; };
      records.push({ id: get("id"), title: get("title"), link: get("link"), price: get("price"), sale_price: get("sale_price"), availability: get("availability"), image_link: get("image_link"), brand: get("brand"), description: get("description"), condition: get("condition"), shipping_price: get("shipping"),
        shipping_available: get("shipping_available"), shipping_scope: get("shipping_scope"), shipping_program: get("shipping_program"), pickup: get("pickup"), protection: get("protection"), seller_type: get("seller_type"), seller_name: get("seller_name"), location: get("location") });
    }
  }
  return records.map((r) => toOffer(r, f)).filter((x): x is RawOffer => !!x);
}

async function loadFeed(f: FeedConfig): Promise<RawOffer[]> {
  const hit = feedCache.get(f.url);
  if (hit && Date.now() - hit.at < 3600_000) return hit.items;
  const body = f.url.startsWith("file://") ? await readFile(new URL(f.url), "utf8") : await (await fetchWithPolicy(f.url, { timeoutMs: 60000 })).text();
  const items = parseFeed(body, f);
  feedCache.set(f.url, { at: Date.now(), items });
  return items;
}

function matchesQuery(o: RawOffer, category: Category, q: string): boolean {
  if (isAccessory(o.title)) return false;
  if (detectCategory(o.title, null) !== category) return false;
  const words = normalize(q).split(" ").filter((w) => w.length > 1 && !["pc", "gamer", "monitor", "computador"].includes(w));
  const t = normalize(o.title);
  return words.every((w) => t.includes(w));
}

export const feeds: Connector = {
  id: "feeds",
  name: "Feeds de produtos (Google Merchant / CSV / JSON)",
  stores: feedConfigs().map((f) => f.store),
  kind: "feed",
  status() {
    const list = feedConfigs();
    return {
      configured: list.length > 0,
      state: list.length ? "unverified" : "needs-credentials",
      message: list.length ? `${list.length} feed(s) configurado(s): ${list.map((f) => f.store).join(", ")}.` : "Nenhum feed configurado. Use feeds de programas de afiliados para lojas sem API (Pichau, Terabyte, Magalu...).",
      requires: ["PRODUCT_FEEDS (JSON com store/url)"],
      docsUrl: "https://support.google.com/merchants/answer/7052112",
    };
  },
  async search(p: SearchParams): Promise<SearchPage> {
    const all: RawOffer[] = [];
    for (const f of feedConfigs()) {
      const items = await loadFeed(f);
      all.push(...items.filter((o) => matchesQuery(o, p.category, defaultQuery(p.category, p.query))).map((o) => ({ ...o, categoryHint: p.category })));
    }
    const start = (p.page - 1) * p.pageSize;
    return { offers: all.slice(start, start + p.pageSize), hasMore: start + p.pageSize < all.length, totalAvailable: all.length };
  },
};
