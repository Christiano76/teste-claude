import { fail, ok } from "@/lib/api";
import { lookupCep } from "@/lib/geo/cep";

export async function GET(_req: Request, ctx: { params: Promise<{ cep: string }> }) {
  try {
    const { cep } = await ctx.params;
    const loc = await lookupCep(cep);
    if (!loc) return ok({ error: "CEP não encontrado" }, { status: 404 });
    return ok(loc);
  } catch (e) {
    return fail(e);
  }
}
