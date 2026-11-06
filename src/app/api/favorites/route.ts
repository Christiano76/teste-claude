import { z } from "zod";
import { addFavorite, listFavorites, removeFavorite } from "@/lib/alerts/service";
import { fail, ok } from "@/lib/api";
import { getOffersByIds } from "@/lib/search/repository";
import { analyzeOffers } from "@/lib/search/service";
import { getSessionId } from "@/lib/user/session";

export async function GET() {
  try {
    const sid = await getSessionId();
    const favs = await listFavorites(sid!);
    const offers = await getOffersByIds(favs.map((f) => Number(f.offer_id)));
    const analyzed = await analyzeOffers(offers, null);
    const items = favs.flatMap((f) => {
      const a = analyzed.find((x) => x.offer.id === Number(f.offer_id));
      return a ? [{ ...a, priceAtSave: f.price_at_save == null ? null : Number(f.price_at_save), savedAt: f.created_at }] : [];
    });
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}

const body = z.object({ offerId: z.number().int().positive() });

export async function POST(req: Request) {
  try {
    const { offerId } = body.parse(await req.json());
    await addFavorite((await getSessionId())!, offerId);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { offerId } = body.parse(await req.json());
    await removeFavorite((await getSessionId())!, offerId);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
