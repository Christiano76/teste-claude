import type { UserLocation } from "../types";
import { fetchJson } from "../util/http";

export function cleanCep(cep: string): string | null {
  const d = cep.replace(/\D/g, "");
  return d.length === 8 ? d : null;
}

const cache = new Map<string, UserLocation>();

/** Resolve o CEP via ViaCEP, com BrasilAPI como alternativa. */
export async function lookupCep(cepInput: string): Promise<UserLocation | null> {
  const cep = cleanCep(cepInput);
  if (!cep) return null;
  const hit = cache.get(cep);
  if (hit) return hit;
  try {
    const v = await fetchJson<{ uf?: string; localidade?: string; erro?: boolean | string }>(`https://viacep.com.br/ws/${cep}/json/`, { timeoutMs: 6000, minIntervalMs: 100, retries: 0 });
    if (!v.erro && v.uf) {
      const loc = { cep, uf: v.uf, city: v.localidade ?? "", source: "viacep" };
      cache.set(cep, loc);
      return loc;
    }
  } catch {
    /* tenta a próxima */
  }
  try {
    const b = await fetchJson<{ state?: string; city?: string }>(`https://brasilapi.com.br/api/cep/v2/${cep}`, { timeoutMs: 6000, minIntervalMs: 100, retries: 0 });
    if (b.state) {
      const loc = { cep, uf: b.state, city: b.city ?? "", source: "brasilapi" };
      cache.set(cep, loc);
      return loc;
    }
  } catch {
    /* sem resultado */
  }
  return null;
}

export const REGION_BY_UF: Record<string, "N" | "NE" | "CO" | "SE" | "S"> = {
  AC: "N", AP: "N", AM: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};
