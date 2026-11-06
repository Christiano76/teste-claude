import type { PoolClient } from "pg";
import { query, withTx } from "../db";
import { canonicalKey, isAccessory, parseSpecs } from "../hardware/specs";
import type { Category, Offer, ParsedSpecs, RawOffer } from "../types";
import { normalize, slugify } from "../util/text";

const STORE_SLUG_BY_NAME: Record<string, string> = {
  "kabum!": "kabum", "mercado livre": "mercadolivre", "amazon brasil": "amazon-br", shopee: "shopee",
  aliexpress: "aliexpress", pichau: "pichau", terabyteshop: "terabyte", "magazine luiza": "magalu",
  "gk infostore": "gkinfostore", patoloco: "patoloco",
};

export function storeSlug(name: string): string {
  return STORE_SLUG_BY_NAME[name.toLowerCase()] ?? slugify(name);
}

/** Valida a oferta: descarta itens sem preço, acessórios e categorias erradas. */
export function prepare(raw: RawOffer, category: Category): { raw: RawOffer; specs: ParsedSpecs; key: string } | null {
  if (!raw.title || !(raw.price > 0) || !raw.url?.startsWith("http")) return null;
  if (isAccessory(raw.title)) return null;
  const specs = parseSpecs(raw.title, raw.specsText, raw.categoryHint ?? category);
  if (specs.category !== category) return null;
  // PC precisa de pelo menos processador identificado; monitor, de tamanho ou resolução
  if (category === "pc" && !specs.pc?.cpu) return null;
  if (category === "monitor" && !specs.monitor?.sizeIn && !specs.monitor?.resolutionLabel) return null;
  return { raw, specs, key: canonicalKey(category, specs, raw.title, raw.brand) };
}

async function ensureStore(c: PoolClient, name: string, source: string, origin: string | null): Promise<string> {
  const slug = storeSlug(name);
  await c.query(
    `INSERT INTO stores (slug, name, ships_from, discovered_via) VALUES ($1,$2,$3,$4)
     ON CONFLICT (slug) DO UPDATE SET offers_seen = stores.offers_seen + 1`,
    [slug, name, origin, source],
  );
  return slug;
}

/** Insere/atualiza ofertas e grava snapshot de preço quando o preço muda (ou a cada 6 h). */
export async function upsertOffers(items: { raw: RawOffer; specs: ParsedSpecs; key: string }[], category: Category): Promise<number[]> {
  if (!items.length) return [];
  return withTx(async (c) => {
    const ids: number[] = [];
    const storeCache = new Map<string, string>();
    for (const { raw: r, specs, key } of items) {
      let slug = storeCache.get(r.storeName);
      if (!slug) {
        slug = await ensureStore(c, r.storeName, r.source, r.origin);
        storeCache.set(r.storeName, slug);
      }
      const pc = specs.pc;
      const m = specs.monitor;
      const storageGb = pc?.storage.reduce((s, x) => s + x.gb, 0) || null;
      const res = await c.query<{ id: string }>(
        `INSERT INTO offers (source, external_id, store_slug, store_name, seller_name, title, title_norm, url, image_url, category,
           price, installment_price, list_price, currency, available, stock_qty, is_marketplace, seller_rating, seller_rating_count,
           product_rating, product_rating_count, warranty_text, free_shipping, shipping_cost, delivery_min, delivery_max, delivery_source,
           origin, taxes_included, condition, brand, seller_location, specs, specs_text, canonical_key,
           cpu_model, cpu_index, gpu_model, gpu_index, ram_gb, storage_gb, includes_monitor, res_label, refresh_hz, size_in, panel,
           last_seen_at, last_checked_at, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,
           $36,$37,$38,$39,$40,$41,$42,$43,$44,$45,$46, now(), now(), true)
         ON CONFLICT (source, external_id) DO UPDATE SET
           store_slug=EXCLUDED.store_slug, store_name=EXCLUDED.store_name, seller_name=EXCLUDED.seller_name, title=EXCLUDED.title,
           title_norm=EXCLUDED.title_norm, url=EXCLUDED.url, image_url=COALESCE(EXCLUDED.image_url, offers.image_url),
           price=EXCLUDED.price, installment_price=EXCLUDED.installment_price, list_price=EXCLUDED.list_price, currency=EXCLUDED.currency,
           available=EXCLUDED.available, stock_qty=EXCLUDED.stock_qty, is_marketplace=EXCLUDED.is_marketplace,
           seller_rating=EXCLUDED.seller_rating, seller_rating_count=EXCLUDED.seller_rating_count, product_rating=EXCLUDED.product_rating,
           product_rating_count=EXCLUDED.product_rating_count,
           warranty_text=COALESCE(EXCLUDED.warranty_text, offers.warranty_text), free_shipping=EXCLUDED.free_shipping,
           shipping_cost=EXCLUDED.shipping_cost, delivery_min=EXCLUDED.delivery_min, delivery_max=EXCLUDED.delivery_max,
           delivery_source=EXCLUDED.delivery_source, origin=EXCLUDED.origin, taxes_included=EXCLUDED.taxes_included,
           condition=EXCLUDED.condition, brand=COALESCE(EXCLUDED.brand, offers.brand), seller_location=EXCLUDED.seller_location,
           -- ficha técnica detalhada (buscada à parte) tem prioridade sobre a extraída só do título
           specs=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.specs ELSE EXCLUDED.specs END,
           specs_text=COALESCE(EXCLUDED.specs_text, offers.specs_text),
           canonical_key=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.canonical_key ELSE EXCLUDED.canonical_key END,
           cpu_model=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.cpu_model ELSE EXCLUDED.cpu_model END,
           cpu_index=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.cpu_index ELSE EXCLUDED.cpu_index END,
           gpu_model=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.gpu_model ELSE EXCLUDED.gpu_model END,
           gpu_index=CASE WHEN offers.details_fetched_at IS NOT NULL AND EXCLUDED.specs_text IS NULL THEN offers.gpu_index ELSE EXCLUDED.gpu_index END,
           ram_gb=COALESCE(EXCLUDED.ram_gb, offers.ram_gb), storage_gb=COALESCE(EXCLUDED.storage_gb, offers.storage_gb),
           includes_monitor=EXCLUDED.includes_monitor, res_label=EXCLUDED.res_label, refresh_hz=EXCLUDED.refresh_hz,
           size_in=EXCLUDED.size_in, panel=EXCLUDED.panel, last_seen_at=now(), last_checked_at=now(), active=true
         RETURNING id`,
        [
          r.source, r.externalId, slug, r.storeName, r.sellerName, r.title, normalize(r.title), r.url, r.imageUrl, category,
          r.price, r.installmentPrice, r.listPrice, r.currency, r.available, r.stockQty, r.isMarketplace, r.sellerRating, r.sellerRatingCount,
          r.productRating, r.productRatingCount, r.warrantyText, r.freeShipping, r.shippingCost, r.delivery?.minDays ?? null,
          r.delivery?.maxDays ?? null, r.delivery?.source ?? null, r.origin, r.taxesIncluded, r.condition, r.brand, r.sellerLocation,
          JSON.stringify(specs), r.specsText, key,
          pc?.cpu?.model ?? null, pc?.cpu?.index ?? null, pc?.gpu?.model ?? null, pc?.gpu?.index ?? null, pc?.ramGb ?? null, storageGb,
          pc?.includesMonitor ?? null, m?.resolutionLabel ?? null, m?.refreshHz ?? null, m?.sizeIn ?? null, m?.panel ?? null,
        ],
      );
      const id = Number(res.rows[0].id);
      ids.push(id);
      // snapshot: se o preço mudou ou o último tem mais de 6 h
      await c.query(
        `INSERT INTO price_snapshots (offer_id, price, list_price, available)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM price_snapshots s WHERE s.offer_id = $1 AND s.price = $2 AND s.captured_at > now() - interval '6 hours'
         )`,
        [id, r.price, r.listPrice, r.available],
      );
    }
    return ids;
  });
}

interface OfferRow {
  id: string; source: string; external_id: string; store_slug: string; store_name: string; seller_name: string | null; title: string;
  url: string; image_url: string | null; category: Category; price: string; installment_price: string | null; list_price: string | null;
  currency: "BRL" | "USD"; available: boolean | null; stock_qty: number | null; is_marketplace: boolean | null;
  seller_rating: string | null; seller_rating_count: number | null; product_rating: string | null; product_rating_count: number | null;
  warranty_text: string | null; free_shipping: boolean | null; shipping_cost: string | null; delivery_min: number | null;
  delivery_max: number | null; delivery_source: string | null; origin: "BR" | "INTL" | null; taxes_included: boolean | null;
  condition: Offer["condition"]; brand: string | null; seller_location: string | null; specs: ParsedSpecs; specs_text: string | null;
  canonical_key: string; first_seen_at: Date; last_seen_at: Date; last_checked_at: Date;
}

const num = (v: string | null) => (v == null ? null : Number(v));

export function rowToOffer(r: OfferRow): Offer {
  return {
    id: Number(r.id), source: r.source, externalId: r.external_id, title: r.title, url: r.url, imageUrl: r.image_url,
    price: Number(r.price), installmentPrice: num(r.installment_price), listPrice: num(r.list_price), currency: r.currency,
    available: r.available, stockQty: r.stock_qty, storeName: r.store_name, sellerName: r.seller_name, isMarketplace: r.is_marketplace,
    sellerRating: num(r.seller_rating), sellerRatingCount: r.seller_rating_count, productRating: num(r.product_rating),
    productRatingCount: r.product_rating_count, warrantyText: r.warranty_text, freeShipping: r.free_shipping,
    shippingCost: num(r.shipping_cost),
    delivery: r.delivery_max != null ? { minDays: r.delivery_min ?? r.delivery_max, maxDays: r.delivery_max, source: r.delivery_source ?? "fonte" } : null,
    origin: r.origin, taxesIncluded: r.taxes_included, condition: r.condition, brand: r.brand, categoryHint: r.category,
    specsText: r.specs_text, sellerLocation: r.seller_location, category: r.category, specs: r.specs, canonicalKey: r.canonical_key,
    firstSeenAt: r.first_seen_at.toISOString(), lastSeenAt: r.last_seen_at.toISOString(), lastCheckedAt: r.last_checked_at.toISOString(),
  };
}

export interface OfferFilters {
  category: Category;
  text?: string;
  minPrice?: number;
  maxPrice?: number;
  cpu?: string;
  gpu?: string;
  minRam?: number;
  minStorage?: number;
  brand?: string;
  stores?: string[];
  freeShipping?: boolean;
  origin?: "BR" | "INTL";
  maxDeliveryDays?: number;
  resolution?: string;
  minRefresh?: number;
  includeUnconfirmed?: boolean;
  includesMonitor?: boolean;
  limit?: number;
}

export async function findOffers(f: OfferFilters): Promise<Offer[]> {
  const where: string[] = ["o.category = $1", "o.active", "o.last_seen_at > now() - interval '3 days'"];
  const p: unknown[] = [f.category];
  const add = (sql: string, v: unknown) => {
    p.push(v);
    where.push(sql.replace("?", `$${p.length}`));
  };
  if (!f.includeUnconfirmed) where.push("o.available IS TRUE");
  else where.push("o.available IS NOT FALSE");
  if (f.text) {
    for (const w of normalize(f.text).split(" ").filter((w) => w.length > 1 && !["pc", "gamer", "monitor", "computador", "de", "com"].includes(w))) {
      add("o.title_norm LIKE ?", `%${w}%`);
    }
  }
  if (f.minPrice != null) add("o.price >= ?", f.minPrice);
  if (f.maxPrice != null) add("o.price <= ?", f.maxPrice);
  if (f.cpu) add("lower(o.cpu_model) LIKE ?", `%${f.cpu.toLowerCase()}%`);
  if (f.gpu) add("lower(o.gpu_model) LIKE ?", `%${f.gpu.toLowerCase()}%`);
  if (f.minRam) add("o.ram_gb >= ?", f.minRam);
  if (f.minStorage) add("o.storage_gb >= ?", f.minStorage);
  if (f.brand) add("lower(o.brand) = ?", f.brand.toLowerCase());
  if (f.stores?.length) add("o.store_slug = ANY(?)", f.stores);
  if (f.freeShipping) where.push("o.free_shipping IS TRUE");
  if (f.origin) add("o.origin = ?", f.origin);
  if (f.maxDeliveryDays) add("o.delivery_max <= ?", f.maxDeliveryDays);
  if (f.resolution) add("o.res_label = ?", f.resolution);
  if (f.minRefresh) add("o.refresh_hz >= ?", f.minRefresh);
  if (f.includesMonitor != null) add("COALESCE(o.includes_monitor,false) = ?", f.includesMonitor);
  p.push(f.limit ?? 800);
  const rows = await query<OfferRow>(`SELECT o.* FROM offers o WHERE ${where.join(" AND ")} ORDER BY o.price ASC LIMIT $${p.length}`, p);
  return rows.map(rowToOffer);
}

export async function getOffer(id: number): Promise<Offer | null> {
  const rows = await query<OfferRow>("SELECT * FROM offers WHERE id = $1", [id]);
  return rows[0] ? rowToOffer(rows[0]) : null;
}

export async function getOffersByIds(ids: number[]): Promise<Offer[]> {
  if (!ids.length) return [];
  const rows = await query<OfferRow>("SELECT * FROM offers WHERE id = ANY($1)", [ids]);
  return rows.map(rowToOffer);
}

/** Pontos (índice, preço) de todas as ofertas ativas para ajustar a curva de mercado. */
export async function marketPoints(category: Category): Promise<{ specs: ParsedSpecs; price: number }[]> {
  const rows = await query<{ specs: ParsedSpecs; price: string }>(
    `SELECT specs, price FROM offers WHERE category = $1 AND active AND available IS TRUE AND origin = 'BR'
       AND last_seen_at > now() - interval '7 days' AND condition IS DISTINCT FROM 'used' LIMIT 5000`,
    [category],
  );
  return rows.map((r) => ({ specs: r.specs, price: Number(r.price) }));
}

export async function updateDetails(id: number, specsText: string | null, warrantyText: string | null, category: Category, title: string, brand: string | null) {
  const specs = parseSpecs(title, specsText, category);
  const key = canonicalKey(category, specs, title, brand);
  const pc = specs.pc;
  await query(
    `UPDATE offers SET specs_text = $2, warranty_text = COALESCE($3, warranty_text), specs = $4, canonical_key = $5,
       cpu_model=$6, cpu_index=$7, gpu_model=$8, gpu_index=$9, ram_gb=COALESCE($10, ram_gb), details_fetched_at = now()
     WHERE id = $1`,
    [id, specsText, warrantyText, JSON.stringify(specs), key, pc?.cpu?.model ?? null, pc?.cpu?.index ?? null, pc?.gpu?.model ?? null, pc?.gpu?.index ?? null, pc?.ramGb ?? null],
  );
}

/** Ofertas que não aparecem há mais de 3 dias são marcadas como inativas (não exibidas como disponíveis). */
export async function deactivateStale(): Promise<number> {
  const r = await query<{ n: string }>("WITH u AS (UPDATE offers SET active = false WHERE active AND last_seen_at < now() - interval '3 days' RETURNING 1) SELECT count(*) AS n FROM u");
  return Number(r[0]?.n ?? 0);
}
