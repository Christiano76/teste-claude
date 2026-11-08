/**
 * Plataformas de classificados SEM meio autorizado de busca para terceiros.
 * Elas aparecem na página de fontes com o motivo verificado e nunca são marcadas
 * como funcionais. Anúncios dessas plataformas só entram no PC Hunter por um
 * feed autorizado (PRODUCT_FEEDS com "kind":"classificados") ou por parceria.
 * Verificações feitas em 06/11/2026.
 */
import type { Connector, SearchPage } from "./types";

function unavailable(id: string, name: string, stores: string[], message: string, evidence: string, requires: string[], docsUrl: string): Connector {
  return {
    id,
    name,
    stores,
    kind: "classificados",
    evidence,
    status: () => ({ configured: false, state: "unavailable", message, requires, docsUrl }),
    async search(): Promise<SearchPage> {
      throw new Error(`${name}: não há integração de busca autorizada.`);
    },
  };
}

export const olx = unavailable(
  "olx",
  "OLX Brasil",
  ["OLX"],
  "Sem API de busca direta (o portal da OLX cobre só publicação de anúncios, leads e chat; o site bloqueia acesso automatizado). Anúncios da OLX são descobertos pelo conector \"OLX (via Brave Search)\", com preço indexado e sem confirmação de Garantia OLX/Entrega Fácil.",
  "06/11/2026: developers.olx.com.br documenta importação de anúncios, leads, chat e destaques, sem endpoint de busca; www.olx.com.br/robots.txt respondeu 403 (Cloudflare) para acesso automatizado.",
  ["Parceria/autorização da OLX", "ou feed autorizado em PRODUCT_FEEDS (kind: classificados)"],
  "https://developers.olx.com.br/",
);

export const facebook = unavailable(
  "facebook",
  "Facebook Marketplace",
  ["Facebook Marketplace"],
  "A Meta não disponibiliza API de busca do Marketplace para terceiros, e os termos proíbem coleta automatizada. Não há como verificar entrega por meios autorizados.",
  "06/11/2026: www.facebook.com/robots.txt restringe agentes automatizados e exige autorização da Meta; não há endpoint público do Marketplace na Graph API.",
  ["Autorização formal da Meta"],
  "https://developers.facebook.com/docs/commerce-platform",
);

export const enjoei = unavailable(
  "enjoei",
  "Enjoei",
  ["Enjoei"],
  "Sem API pública e o robots.txt proíbe rastrear a busca. Páginas de produto indexadas são consultadas pelo conector \"Enjoei (via Brave Search)\".",
  "06/11/2026: www.enjoei.com.br/robots.txt contém \"Disallow: /busca\" e bloqueia parâmetros de busca.",
  ["Parceria/feed autorizado do Enjoei"],
  "https://www.enjoei.com.br/",
);
