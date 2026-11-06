/** Worker de atualização: `npm run refresh` (pode rodar via cron do sistema, GitHub Actions etc.). */
import { pool } from "../src/lib/db";
import { refreshAll } from "../src/lib/search/refresh";

const pages = Number(process.argv[2] ?? process.env.CRON_PAGES ?? 5);
refreshAll({ pages, budgetMs: 15 * 60_000, detailsLimit: Number(process.env.DETAILS_LIMIT ?? 60) })
  .then((r) => {
    for (const run of r.runs) console.log(`${run.source.padEnd(14)} ${run.status.padEnd(7)} ${String(run.items).padStart(5)} itens ${run.error ?? ""}`);
    console.log(`Fichas técnicas: ${r.detailsFetched} · desativadas: ${r.deactivated} · alertas: ${r.alerts.triggered}/${r.alerts.checked} · ${(r.durationMs / 1000).toFixed(1)}s`);
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool().end());
