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
  for (const [re, msg] of BAD_WORDS) if (re.test(offer.title)) flags.push({ level: "danger", code: "keyword", message: msg });

  if (expectedPrice && totalCost < expectedPrice * 0.35) {
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
  if (offer.condition === "used") flags.push({ level: "info", code: "used", message: "Produto usado." });
  if (offer.condition === "refurbished") flags.push({ level: "info", code: "refurb", message: "Produto recondicionado/open box." });
  return flags;
}
