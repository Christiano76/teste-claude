import type { Condition } from "../types";

export const CONDITION_LABEL: Record<Condition, string> = {
  novo: "Novo", seminovo: "Seminovo", usado: "Usado", recondicionado: "Recondicionado", mostruario: "Mostruário", "nao-informado": "Não informado",
};

/**
 * Fator de preço justo em relação ao equivalente novo. Um usado "vale" menos que um novo:
 * o desconto real é medido contra o preço justo do MESMO estado, não contra o novo.
 */
export const CONDITION_FACTOR: Record<Condition, number> = {
  novo: 1, mostruario: 0.88, recondicionado: 0.8, seminovo: 0.75, usado: 0.68, "nao-informado": 0.85,
};

/** Classifica o estado pelo dado estruturado da fonte e pelo texto do anúncio. */
export function classifyCondition(title: string, text: string | null, sourceCondition: string | null, opts: { openbox?: boolean; storeSellsNewByDefault?: boolean } = {}): Condition {
  const t = `${title}\n${(text ?? "").slice(0, 600)}`.toLowerCase();
  if (opts.openbox || /mostru[aá]rio|\bvitrine\b|open ?box|embalagem aberta/.test(t)) return "mostruario";
  if (/recondicionad|refurbish|renovad[oa]|remanufaturad|revisad[oa] pelo fabricante/.test(t)) return "recondicionado";
  if (/semi[\s-]?nov[oa]|seminov/.test(t)) return "seminovo";
  if (/\busad[oa]s?\b|second hand|de segunda m[aã]o/.test(t)) return "usado";
  if (/\b(novo|nova|lacrad[oa])\b/.test(title.toLowerCase())) return "novo";
  if (sourceCondition) {
    const c = sourceCondition.toLowerCase();
    if (c === "new" || c === "novo") return "novo";
    if (c === "used" || c === "usado") return "usado";
    if (c === "refurbished") return "recondicionado";
  }
  return opts.storeSellsNewByDefault ? "novo" : "nao-informado";
}
