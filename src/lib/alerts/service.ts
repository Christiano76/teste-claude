import { config } from "../config";
import { query } from "../db";
import { brl } from "../util/text";

export async function listFavorites(sessionId: string) {
  return query<{ offer_id: string; price_at_save: string | null; created_at: Date }>("SELECT offer_id, price_at_save, created_at FROM favorites WHERE session_id=$1 ORDER BY created_at DESC", [sessionId]);
}

export async function addFavorite(sessionId: string, offerId: number) {
  await query("INSERT INTO favorites (session_id, offer_id, price_at_save) SELECT $1, id, price FROM offers WHERE id=$2 ON CONFLICT DO NOTHING", [sessionId, offerId]);
}

export async function removeFavorite(sessionId: string, offerId: number) {
  await query("DELETE FROM favorites WHERE session_id=$1 AND offer_id=$2", [sessionId, offerId]);
}

export interface AlertRow {
  id: string; offer_id: string | null; canonical_key: string | null; target_price: string; email: string | null; active: boolean;
  created_at: Date; triggered_at: Date | null; triggered_price: string | null; title: string | null; current_price: string | null;
}

export async function listAlerts(sessionId: string) {
  return query<AlertRow>(
    `SELECT a.*, o.title, o.price AS current_price FROM alerts a LEFT JOIN offers o ON o.id = a.offer_id WHERE a.session_id=$1 ORDER BY a.created_at DESC`,
    [sessionId],
  );
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;

export async function createAlert(sessionId: string, offerId: number, targetPrice: number, email: string | null, anyStore: boolean) {
  if (!(targetPrice > 0)) throw new Error("Preço-alvo inválido.");
  if (email && !EMAIL_RE.test(email)) throw new Error("E-mail inválido.");
  const [o] = await query<{ canonical_key: string }>("SELECT canonical_key FROM offers WHERE id=$1", [offerId]);
  if (!o) throw new Error("Oferta não encontrada.");
  const [a] = await query<{ id: string }>(
    "INSERT INTO alerts (session_id, offer_id, canonical_key, target_price, email) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [sessionId, offerId, anyStore ? o.canonical_key : null, targetPrice, email],
  );
  return Number(a.id);
}

export async function deleteAlert(sessionId: string, id: number) {
  await query("DELETE FROM alerts WHERE session_id=$1 AND id=$2", [sessionId, id]);
}

export async function listNotifications(sessionId: string) {
  return query<{ id: string; message: string; price: string | null; offer_id: string | null; created_at: Date; read_at: Date | null }>(
    "SELECT id, message, price, offer_id, created_at, read_at FROM notifications WHERE session_id=$1 ORDER BY created_at DESC LIMIT 50",
    [sessionId],
  );
}

export async function markNotificationsRead(sessionId: string) {
  await query("UPDATE notifications SET read_at = now() WHERE session_id=$1 AND read_at IS NULL", [sessionId]);
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!config.email.resendApiKey) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${config.email.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: config.email.from, to, subject, text }),
  });
  return res.ok;
}

/**
 * Verifica alertas ativos: dispara quando a oferta (ou o mesmo produto em qualquer loja,
 * se `canonical_key` estiver definido) atinge o preço-alvo, está disponível e foi vista recentemente.
 */
export async function checkAlerts(): Promise<{ checked: number; triggered: number; emailed: number }> {
  const hits = await query<{ alert_id: string; session_id: string; email: string | null; target_price: string; offer_id: string; price: string; title: string; store_name: string; url: string }>(
    `SELECT DISTINCT ON (a.id) a.id AS alert_id, a.session_id, a.email, a.target_price, o.id AS offer_id, o.price, o.title, o.store_name, o.url
     FROM alerts a
     JOIN offers o ON (o.id = a.offer_id OR (a.canonical_key IS NOT NULL AND o.canonical_key = a.canonical_key))
     WHERE a.active AND o.active AND o.available IS TRUE AND o.last_seen_at > now() - interval '1 day' AND o.price <= a.target_price
     ORDER BY a.id, o.price ASC`,
  );
  const [{ n }] = await query<{ n: string }>("SELECT count(*) AS n FROM alerts WHERE active");
  let emailed = 0;
  for (const h of hits) {
    const msg = `${h.title} chegou a ${brl(Number(h.price))} em ${h.store_name} (seu alvo: ${brl(Number(h.target_price))}).`;
    let sent = false;
    if (h.email) {
      try {
        sent = await sendEmail(h.email, "PC Hunter: preço-alvo atingido", `${msg}\n\n${h.url}\n\nVer no PC Hunter: ${config.appUrl}/oferta/${h.offer_id}`);
      } catch {
        sent = false;
      }
      if (sent) emailed++;
    }
    await query("INSERT INTO notifications (session_id, alert_id, offer_id, message, price, emailed) VALUES ($1,$2,$3,$4,$5,$6)", [h.session_id, h.alert_id, h.offer_id, msg, h.price, sent]);
    await query("UPDATE alerts SET active=false, triggered_at=now(), triggered_price=$2 WHERE id=$1", [h.alert_id, h.price]);
  }
  return { checked: Number(n), triggered: hits.length, emailed };
}
