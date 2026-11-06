import { fetchJson } from "../util/http";

let cached: { rate: number; date: string; at: number } | null = null;

function fmt(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}-${d.getFullYear()}`;
}

/**
 * Cotação PTAX de venda do dólar (Banco Central). Procura até 7 dias para trás
 * (fins de semana/feriados). Retorna null se o BCB estiver indisponível.
 */
export async function usdBrl(): Promise<{ rate: number; date: string } | null> {
  if (cached && Date.now() - cached.at < 6 * 3600_000) return cached;
  const end = new Date();
  const start = new Date(Date.now() - 7 * 86400_000);
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@i,dataFinalCotacao=@f)?@i='${fmt(start)}'&@f='${fmt(end)}'&$format=json&$orderby=dataHoraCotacao%20desc&$top=1`;
  try {
    const d = await fetchJson<{ value: { cotacaoVenda: number; dataHoraCotacao: string }[] }>(url, { timeoutMs: 8000, retries: 1 });
    const v = d.value?.[0];
    if (!v) return null;
    cached = { rate: v.cotacaoVenda, date: v.dataHoraCotacao, at: Date.now() };
    return cached;
  } catch {
    return null;
  }
}
