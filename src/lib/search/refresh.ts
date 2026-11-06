import { config } from "../config";
import { checkAlerts } from "../alerts/service";
import { collect, enrichOffer, offersNeedingDetails, type SourceRun } from "./collect";
import { deactivateStale } from "./repository";

/** Buscas amplas usadas na atualização periódica (mineração contínua). */
export const CRON_QUERIES: { category: "pc" | "monitor"; query: string }[] = [
  { category: "pc", query: "" },
  { category: "pc", query: "rtx" },
  { category: "pc", query: "radeon rx" },
  { category: "pc", query: "computador completo" },
  { category: "monitor", query: "" },
  { category: "monitor", query: "monitor 27" },
  { category: "monitor", query: "monitor 24" },
];

export interface RefreshReport {
  runs: SourceRun[];
  detailsFetched: number;
  deactivated: number;
  alerts: { checked: number; triggered: number; emailed: number };
  durationMs: number;
}

/** Atualização agendada: coleta profunda, enriquece fichas técnicas, desativa itens sumidos e verifica alertas. */
export async function refreshAll(opts: { pages?: number; detailsLimit?: number; budgetMs?: number } = {}): Promise<RefreshReport> {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? 250_000;
  const runs: SourceRun[] = [];
  for (const q of CRON_QUERIES) {
    if (Date.now() - t0 > budget * 0.7) break;
    runs.push(...(await collect(q.category, q.query, { pages: opts.pages ?? config.cronPages, trigger: "cron", force: true, timeoutMs: budget * 0.25 })));
  }
  let detailsFetched = 0;
  for (const id of await offersNeedingDetails(opts.detailsLimit ?? 40)) {
    if (Date.now() - t0 > budget * 0.9) break;
    try {
      if (await enrichOffer(id)) detailsFetched++;
    } catch {
      /* segue */
    }
  }
  const deactivated = await deactivateStale();
  const alerts = await checkAlerts();
  return { runs, detailsFetched, deactivated, alerts, durationMs: Date.now() - t0 };
}
