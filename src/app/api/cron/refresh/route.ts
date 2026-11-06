import { config } from "@/lib/config";
import { fail, ok } from "@/lib/api";
import { refreshAll } from "@/lib/search/refresh";

export const maxDuration = 300;

/** Chamado pelo agendador (Vercel Cron envia "Authorization: Bearer $CRON_SECRET"). */
export async function GET(req: Request) {
  if (!config.cronSecret || req.headers.get("authorization") !== `Bearer ${config.cronSecret}`) {
    return ok({ error: "não autorizado" }, { status: 401 });
  }
  try {
    const pages = Number(new URL(req.url).searchParams.get("pages") ?? config.cronPages);
    return ok(await refreshAll({ pages, budgetMs: 270_000 }));
  } catch (e) {
    return fail(e);
  }
}
