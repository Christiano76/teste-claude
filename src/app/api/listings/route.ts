import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { query } from "@/lib/db";
import { normalize } from "@/lib/util/text";

const schema = z.object({ category: z.enum(["pc", "monitor", "kit", "peca"]), q: z.string().max(120).optional() });

/** Anúncios individuais encontrados pelo buscador SEM preço no índice. */
export async function GET(req: Request) {
  try {
    const p = schema.parse(Object.fromEntries(new URL(req.url).searchParams));
    const words = normalize(p.q ?? "").split(" ").filter((w) => w.length > 1).slice(0, 5);
    const params: unknown[] = [p.category];
    const where = ["category = $1", "last_seen_at > now() - interval '3 days'"];
    for (const w of words) {
      params.push(`%${w}%`);
      where.push(`lower(title) LIKE $${params.length}`);
    }
    const items = await query(
      `SELECT url, platform, title, image_url, location, indexed_at, last_seen_at FROM discovered_listings WHERE ${where.join(" AND ")} ORDER BY last_seen_at DESC LIMIT 60`,
      params,
    );
    return ok({ items });
  } catch (e) {
    return fail(e);
  }
}
