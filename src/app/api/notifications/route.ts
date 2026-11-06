import { listNotifications, markNotificationsRead } from "@/lib/alerts/service";
import { fail, ok } from "@/lib/api";
import { getSessionId } from "@/lib/user/session";

export async function GET() {
  try {
    const rows = await listNotifications((await getSessionId())!);
    return ok({ items: rows.map((r) => ({ id: Number(r.id), message: r.message, price: r.price == null ? null : Number(r.price), offerId: r.offer_id ? Number(r.offer_id) : null, createdAt: r.created_at, read: !!r.read_at })) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST() {
  try {
    await markNotificationsRead((await getSessionId())!);
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
