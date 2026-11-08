import { CONDITION_LABEL } from "../market/condition";
import type { Flag, Offer } from "../types";

const BAD_WORDS: [RegExp, string][] = [
  [/r[eé]plica|similar ao|tipo original|1a linha/i, "Título indica réplica/similar."],
  [/leia (a )?descri[cç][aã]o|consulte (antes|disponibilidade)|n[aã]o compre/i, "Anúncio pede para ler a descrição/consultar antes — condições podem diferir do título."],
  [/defeito|n[aã]o liga|para (retirada de )?pe[cç]as|sucata|no estado/i, "Produto com defeito ou para peças."],
  [/an[uú]ncio teste|teste n[aã]o compre/i, "Anúncio de teste."],
  [/aluguel|loca[cç][aã]o/i, "Anúncio de aluguel, não de venda."],
  [/sob encomenda|pr[eé]-?venda/i, "Venda sob encomenda/pré-venda: prazo maior e estoque não imediato."],
];

export interface SuspicionInput {
  offer: Offer;
  expectedPrice: number | null;
  totalCost: number;
}

export function detectSuspicious({ offer, expectedPrice, totalCost }: SuspicionInput): Flag[] {
  const flags: Flag[] = [];
  // defeito: busca no título e no trecho do anúncio (equipamento com defeito nunca é apresentado como funcional)
  const text = `${offer.title}\n${(offer.specsText ?? "").slice(0, 800)}`;
  for (const [re, msg] of BAD_WORDS) {
    const isDefect = msg.startsWith("Produto com defeito");
    if (re.test(isDefect ? text : offer.title)) flags.push({ level: "danger", code: isDefect ? "defect" : "keyword", message: msg });
  }

  // itens baratos/antigos têm mercado de usados bem abaixo do novo: o alerta exige diferença maior
  const tooCheap = expectedPrice && expectedPrice < 2000 ? 0.25 : 0.35;
  if (expectedPrice && totalCost < expectedPrice * tooCheap) {
    flags.push({ level: "danger", code: "too-cheap", message: "Preço muito abaixo do mercado para esta configuração — possível golpe, erro no anúncio ou especificação enganosa." });
  } else if (expectedPrice && totalCost < expectedPrice * 0.55 && (offer.sellerRatingCount ?? 0) < 20 && offer.isMarketplace) {
    flags.push({ level: "warn", code: "cheap-unknown-seller", message: "Preço bem abaixo do mercado vendido por vendedor com pouco histórico. Confirme a reputação antes de comprar." });
  }

  if (offer.listPrice && offer.listPrice > offer.price * 3.3) {
    flags.push({ level: "warn", code: "huge-discount", message: `Desconto anunciado de ${Math.round((1 - offer.price / offer.listPrice) * 100)}% — descontos extremos costumam ser preço "de" inflado.` });
  }
  if (offer.sellerRating != null && (offer.sellerRatingCount ?? 0) >= 10 && offer.sellerRating < 3.5) {
    flags.push({ level: "warn", code: "bad-seller", message: `Vendedor com avaliação baixa (${offer.sellerRating.toFixed(1)}/5).` });
  }

  const pc = offer.specs.pc;
  if (pc && /gamer/i.test(offer.title)) {
    if (pc.gpu?.index != null && pc.gpu.index < 15) {
      flags.push({ level: "warn", code: "fake-gamer", message: `Anunciado como "gamer", mas ${pc.gpu.integrated ? "usa vídeo integrado" : `a placa de vídeo (${pc.gpu.model}) é muito fraca`} para jogos atuais.` });
    }
    if (pc.ramType === "DDR3" || pc.cpu?.generationAge === "obsolete") {
      flags.push({ level: "warn", code: "obsolete", message: `Plataforma antiga (${pc.cpu?.model ?? "DDR3"}) vendida como gamer — sem caminho de upgrade.` });
    }
  }
  if (offer.condition && offer.condition !== "novo") flags.push({ level: "info", code: "condition", message: `Estado: ${CONDITION_LABEL[offer.condition]}.` });
  // pagamento fora da plataforma / contato direto
  const txt = `${offer.title}\n${offer.specsText ?? ""}`;
  if (/(pix|dep[oó]sito|transfer[eê]ncia)\s*(direto|antecipad)|chama (no|na|pelo) (zap|whats)|(me )?chama no (zap|whats)|(contato|negocia[cç][aã]o|negociar) (s[oó] )?(pelo|no|via) (zap|whats)|fora da plataforma|s[oó] (no|pelo|via) pix|pagamento antecipado|pago antecipado/i.test(txt)) {
    flags.push({ level: "danger", code: "off-platform", message: "Anúncio sugere pagamento ou contato fora da plataforma — prática comum em golpes." });
  }
  // especificações inconsistentes: duas placas de vídeo diferentes citadas no título
  const gpus = offer.title.match(/\b(rtx|gtx|rx)\s?-?\d{3,4}/gi);
  if (gpus && new Set(gpus.map((g) => g.toLowerCase().replace(/[\s-]/g, ""))).size > 1 && !/ou|\/|op[cç][aã]o/i.test(offer.title)) {
    flags.push({ level: "warn", code: "inconsistent", message: `Título cita placas de vídeo diferentes (${[...new Set(gpus)].join(", ")}) — especificação inconsistente.` });
  }
  return flags;
}
