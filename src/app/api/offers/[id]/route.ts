import { fail, ok } from "@/lib/api";
import { lookupCep } from "@/lib/geo/cep";
import { getHistory } from "@/lib/history/service";
import { query } from "@/lib/db";
import { enrichOffer } from "@/lib/search/collect";
import { getOffer, getOffersByIds } from "@/lib/search/repository";
import { analyzeOffers } from "@/lib/search/service";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: idStr } = await ctx.params;
    const id = Number(idStr);
    if (!Number.isInteger(id) || id <= 0) return ok({ error: "id inválido" }, { status: 400 });
    let offer = await getOffer(id);
    if (!offer) return ok({ error: "Oferta não encontrada" }, { status: 404 });

    // Ficha técnica completa sob demanda (uma vez por oferta)
    const [{ fetched }] = await query<{ fetched: boolean }>("SELECT details_fetched_at IS NOT NULL AS fetched FROM offers WHERE id=$1", [id]);
    if (!fetched) {
      try {
        if (await enrichOffer(id)) offer = (await getOffer(id))!;
      } catch {
        /* segue com os dados do título */
      }
    }
    const cep = new URL(req.url).searchParams.get("cep");
    const location = cep ? await lookupCep(cep) : null;
    const sameRows = await query<{ id: string }>(
      "SELECT id FROM offers WHERE canonical_key=$1 AND id<>$2 AND active AND available IS TRUE AND canonical_key NOT LIKE '%?%' ORDER BY price LIMIT 8",
      [offer.canonicalKey, id],
    );
    const others = await getOffersByIds(sameRows.map((r) => Number(r.id)));
    const analyzed = await analyzeOffers([offer, ...others], location);
    const history = await getHistory(id);
    return ok({ item: analyzed[0], sameConfig: analyzed.slice(1), history, location });
  } catch (e) {
    return fail(e);
  }
}
