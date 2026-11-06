import { z } from "zod";
import { createAlert, deleteAlert, listAlerts } from "@/lib/alerts/service";
import { fail, ok } from "@/lib/api";
import { getSessionId } from "@/lib/user/session";

export async function GET() {
  try {
    const rows = await listAlerts((await getSessionId())!);
    return ok({
      items: rows.map((r) => ({
        id: Number(r.id), offerId: r.offer_id ? Number(r.offer_id) : null, title: r.title, targetPrice: Number(r.target_price),
        currentPrice: r.current_price == null ? null : Number(r.current_price), anyStore: !!r.canonical_key, hasEmail: !!r.email,
        active: r.active, createdAt: r.created_at, triggeredAt: r.triggered_at, triggeredPrice: r.triggered_price == null ? null : Number(r.triggered_price),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  offerId: z.number().int().positive(),
  targetPrice: z.number().positive().max(1_000_000),
  email: z.string().email().max(254).optional().or(z.literal("")),
  anyStore: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const b = createSchema.parse(await req.json());
    const id = await createAlert((await getSessionId())!, b.offerId, b.targetPrice, b.email || null, b.anyStore ?? true);
    return ok({ id });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = z.object({ id: z.number().int().positive() }).parse(await req.json());
    await deleteAlert((await getSessionId())!, id);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
