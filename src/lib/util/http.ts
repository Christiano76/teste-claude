import { config } from "../config";

const lastHit = new Map<string, number>();

/** Espera para respeitar um intervalo mínimo entre requisições ao mesmo host (coleta educada). */
async function politeDelay(host: string, minIntervalMs: number) {
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + minIntervalMs - Date.now();
  lastHit.set(host, Math.max(Date.now(), prev + minIntervalMs));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

export class HttpError extends Error {
  constructor(public status: number, public url: string, body: string) {
    super(`HTTP ${status} em ${new URL(url).host}: ${body.slice(0, 200)}`);
  }
}

export interface FetchOpts extends RequestInit {
  timeoutMs?: number;
  minIntervalMs?: number;
  retries?: number;
}

export async function fetchWithPolicy(url: string, opts: FetchOpts = {}): Promise<Response> {
  const { timeoutMs = 12000, minIntervalMs = 700, retries = 1, ...init } = opts;
  const host = new URL(url).host;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await politeDelay(host, minIntervalMs);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: { "User-Agent": config.userAgent, Accept: "application/json, text/plain, */*", ...(init.headers ?? {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, url, await res.text());
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchJson<T>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetchWithPolicy(url, opts);
  if (!res.ok) throw new HttpError(res.status, url, await res.text());
  return (await res.json()) as T;
}
