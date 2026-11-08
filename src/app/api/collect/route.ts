import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { lookupCep } from "@/lib/geo/cep";
import { collect } from "@/lib/search/collect";
import type { Category } from "@/lib/types";

const schema = z.object({
  source: z.string().max(40),
  mode: z.enum(["pc", "pc-monitor", "monitor", "kit", "peca", "garimpo-entrega"]),
  q: z.string().max(120).optional(),
  cep: z.string().regex(/^\d{5}-?\d{3}$/).optional(),
  maxPrice: z.number().positive().max(1_000_000).optional(),
  refresh: z.boolean().optional(),
});

export const maxDuration = 60;

/** Consulta UMA fonte (usado pela tela para mostrar o progresso fonte a fonte). */
export async function POST(req: Request) {
  try {
    const b = schema.parse(await req.json());
    const loc = b.cep ? await lookupCep(b.cep) : null;
    const cats: Category[] = b.mode === "pc-monitor" ? ["pc", "monitor"] : b.mode === "garimpo-entrega" ? ["pc", "monitor", "kit"] : [b.mode];
    const t0 = Date.now();
    const runs = [];
    for (const c of cats) {
      const q = b.mode === "pc-monitor" && c === "monitor" ? "" : b.q ?? "";
      runs.push(...(await collect(c, q, { only: [b.source], maxPrice: b.maxPrice, uf: loc?.uf ?? null, force: b.refresh })));
    }
    const err = runs.find((r) => r.status === "error");
    return ok({
      source: b.source,
      status: err ? "error" : runs.every((r) => r.status === "cached") ? "cached" : "ok",
      items: runs.reduce((n, r) => n + r.items, 0),
      error: err?.error ?? null,
      ms: Date.now() - t0,
    });
  } catch (e) {
    return fail(e);
  }
}
