import { query } from "../db";
import type { PriceInsight } from "../types";

export interface Snapshot {
  price: number;
  listPrice: number | null;
  capturedAt: string;
}

export async function getHistory(offerId: number, days = 180): Promise<Snapshot[]> {
  const rows = await query<{ price: string; list_price: string | null; captured_at: Date }>(
    `SELECT price, list_price, captured_at FROM price_snapshots WHERE offer_id = $1 AND captured_at > now() - ($2 || ' days')::interval ORDER BY captured_at`,
    [offerId, String(days)],
  );
  return rows.map((r) => ({ price: Number(r.price), listPrice: r.list_price == null ? null : Number(r.list_price), capturedAt: r.captured_at.toISOString() }));
}

export async function getHistories(ids: number[], days = 90): Promise<Map<number, Snapshot[]>> {
  const out = new Map<number, Snapshot[]>();
  if (!ids.length) return out;
  const rows = await query<{ offer_id: string; price: string; list_price: string | null; captured_at: Date }>(
    `SELECT offer_id, price, list_price, captured_at FROM price_snapshots WHERE offer_id = ANY($1) AND captured_at > now() - ($2 || ' days')::interval ORDER BY captured_at`,
    [ids, String(days)],
  );
  for (const r of rows) {
    const id = Number(r.offer_id);
    if (!out.has(id)) out.set(id, []);
    out.get(id)!.push({ price: Number(r.price), listPrice: r.list_price == null ? null : Number(r.list_price), capturedAt: r.captured_at.toISOString() });
  }
  return out;
}

/**
 * Analisa o histórico de preços:
 * - posição do preço atual entre mínimo/média/máximo;
 * - "desconto maquiado": preço "de" que nunca foi praticado, ou aumento recente
 *   seguido de "promoção" que só devolve o preço ao patamar anterior.
 */
export function priceInsight(history: Snapshot[], current: number, listPrice: number | null): PriceInsight {
  const n = history.length;
  const first = n ? new Date(history[0].capturedAt).getTime() : Date.now();
  const daysCovered = Math.round((Date.now() - first) / 86400_000);
  const prices = history.map((h) => h.price);
  const base: PriceInsight = { samples: n, daysCovered, min: null, max: null, avg: null, current, position: "insuficiente", fakeDiscount: false, message: "" };
  if (n < 3 || daysCovered < 3) {
    return { ...base, message: listPrice ? `Preço "de" R$ ${listPrice.toFixed(2)} ainda não verificado — histórico insuficiente (${n} registro(s)).` : `Histórico em formação (${n} registro(s) em ${daysCovered} dia(s)).` };
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((s, x) => s + x, 0) / n;
  let position: PriceInsight["position"];
  if (current <= min * 1.02) position = "otimo";
  else if (current <= avg * 0.97) position = "bom";
  else if (current <= avg * 1.03) position = "medio";
  else position = "alto";

  let fakeDiscount = false;
  let msg = "";
  if (listPrice && daysCovered >= 7 && max < listPrice * 0.9) {
    fakeDiscount = true;
    msg = `Promoção suspeita: o preço "de" (R$ ${listPrice.toFixed(2)}) nunca foi praticado nos últimos ${daysCovered} dias (máximo observado R$ ${max.toFixed(2)}).`;
  }
  // aumento ≥10% nos últimos 30 dias antes da "promoção" atual, voltando ao patamar anterior
  const cutoff = Date.now() - 30 * 86400_000;
  const recent = history.filter((h) => new Date(h.capturedAt).getTime() >= cutoff);
  const before = history.filter((h) => new Date(h.capturedAt).getTime() < cutoff);
  if (!fakeDiscount && recent.length >= 3 && before.length >= 2 && listPrice) {
    const peak = Math.max(...recent.map((h) => h.price));
    const priorMin = Math.min(...before.map((h) => h.price));
    if (peak >= priorMin * 1.1 && current >= priorMin * 0.98) {
      fakeDiscount = true;
      msg = `Desconto maquiado: o preço subiu para R$ ${peak.toFixed(2)} recentemente e a "promoção" apenas o devolveu ao patamar anterior (~R$ ${priorMin.toFixed(2)}).`;
    }
  }
  if (!msg) {
    msg = {
      otimo: `Preço no mínimo dos últimos ${daysCovered} dias.`,
      bom: `Abaixo da média dos últimos ${daysCovered} dias (média R$ ${avg.toFixed(2)}).`,
      medio: `Na média dos últimos ${daysCovered} dias.`,
      alto: `Acima da média dos últimos ${daysCovered} dias (mínimo foi R$ ${min.toFixed(2)}).`,
      insuficiente: "",
    }[position];
  }
  return { samples: n, daysCovered, min, max, avg: Math.round(avg * 100) / 100, current, position, fakeDiscount, message: msg };
}
