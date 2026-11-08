/**
 * Cliente da Brave Search API (servidor apenas — a chave nunca vai ao navegador).
 * - Cache das respostas no banco (search_cache) para reduzir consumo.
 * - Limite de requisições por segundo e nova tentativa respeitando Retry-After em 429.
 * - Erros tipados: sem chave, chave inválida, limite excedido, falha de rede.
 */
import { createHash } from "crypto";
import { config } from "../config";
import { query } from "../db";

export interface BraveResult {
  title: string;
  url: string;
  description?: string;
  extra_snippets?: string[];
  age?: string;
  page_age?: string;
  thumbnail?: { src?: string; original?: string };
  product?: { name?: string; price?: string; thumbnail?: { src?: string } };
  meta_url?: { hostname?: string };
}

export class BraveError extends Error {
  constructor(public code: "no-key" | "invalid-key" | "rate-limit" | "http" | "network", message: string) {
    super(message);
  }
}

let nextSlot = 0;
async function throttle() {
  const gap = 1000 / Math.max(1, config.brave.rps);
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + gap;
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export interface BraveQuery {
  q: string;
  count?: number; // até 20
  offset?: number; // até 9
}

/** Contador de consultas reais (não cacheadas) feitas no processo — para relatórios e testes. */
export const braveStats = { live: 0, cached: 0, errors: 0 };

export async function braveSearch({ q, count = 20, offset = 0 }: BraveQuery): Promise<{ results: BraveResult[]; cached: boolean }> {
  const params = { q, country: "BR", search_lang: "pt-br", count: String(count), offset: String(offset), extra_snippets: "true", safesearch: "moderate" };
  const key = "brave:" + createHash("sha256").update(JSON.stringify(params)).digest("hex").slice(0, 40);
  const hit = await query<{ response: { results: BraveResult[] } }>(
    `SELECT response FROM search_cache WHERE key = $1 AND status = 200 AND fetched_at > now() - ($2 || ' hours')::interval`,
    [key, String(config.brave.cacheHours)],
  );
  if (hit[0]) {
    braveStats.cached++;
    return { results: hit[0].response.results, cached: true };
  }
  if (!config.brave.apiKey) throw new BraveError("no-key", "BRAVE_SEARCH_API_KEY não configurada no servidor.");

  const url = `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams(params)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    await throttle();
    let res: Response;
    try {
      res = await fetch(url, { headers: { Accept: "application/json", "X-Subscription-Token": config.brave.apiKey }, signal: AbortSignal.timeout(15000) });
    } catch (e) {
      if (attempt === 2) { braveStats.errors++; throw new BraveError("network", `Brave: falha de rede (${e instanceof Error ? e.message : e}).`); }
      continue;
    }
    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after") ?? 1);
      await new Promise((r) => setTimeout(r, Math.min(10, ra || 1) * 1000));
      if (attempt === 2) { braveStats.errors++; throw new BraveError("rate-limit", "Brave: limite de requisições excedido; tente novamente em instantes."); }
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 422) {
      braveStats.errors++;
      throw new BraveError("invalid-key", `Brave: chave recusada (HTTP ${res.status}).`);
    }
    if (!res.ok) {
      if (attempt === 2 || res.status < 500) { braveStats.errors++; throw new BraveError("http", `Brave: HTTP ${res.status}.`); }
      continue;
    }
    const body = (await res.json()) as { web?: { results?: BraveResult[] } };
    const results = body.web?.results ?? [];
    // guarda só o que usamos (resposta menor no cache)
    const slim = results.map((r) => ({ title: r.title, url: r.url, description: r.description, extra_snippets: r.extra_snippets?.slice(0, 3), age: r.age, page_age: r.page_age, thumbnail: r.thumbnail ? { src: r.thumbnail.src, original: r.thumbnail.original } : undefined, product: r.product ? { name: r.product.name, price: r.product.price, thumbnail: r.product.thumbnail ? { src: r.product.thumbnail.src } : undefined } : undefined, meta_url: r.meta_url ? { hostname: r.meta_url.hostname } : undefined }));
    await query(
      `INSERT INTO search_cache (key, provider, query, response, status) VALUES ($1,'brave',$2,$3,200)
       ON CONFLICT (key) DO UPDATE SET response = EXCLUDED.response, status = 200, fetched_at = now()`,
      // remove \u0000 (o Postgres não aceita em JSONB/TEXT)
      [key, q, JSON.stringify({ results: slim }).replace(/\\u0000/g, "")],
    );
    braveStats.live++;
    return { results: slim, cached: false };
  }
  throw new BraveError("http", "Brave: falha após novas tentativas.");
}

/** Remove HTML e entidades dos trechos da Brave. */
export function cleanText(s: string | undefined | null): string {
  return (s ?? "").replace(/\u0000/g, "").replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}
