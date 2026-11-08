/**
 * Plataformas consultadas via índice da Brave (operador site:).
 * Para cada uma: como reconhecer a página de UM anúncio/produto (e não listagens/buscas),
 * extrair o ID, limpar o título e a localização. Nada aqui acessa as páginas diretamente.
 */
export interface Platform {
  id: string;
  name: string;
  /** domínios para o operador site: ({uf} é trocado pela UF do comprador, minúscula). */
  sites: string[];
  /** URL de anúncio/produto individual. */
  isItem: (u: URL) => boolean;
  itemId: (u: URL) => string;
  cleanTitle?: (t: string) => string;
  location?: (u: URL, title: string) => string | null;
  kind: "classificados" | "marketplace" | "loja";
  /** Loja que vende produtos novos por padrão. */
  sellsNew: boolean;
  isMarketplace: boolean;
  origin: "BR" | "INTL";
  /** Proteção ao comprador da plataforma quando a compra é feita por ela (política pública da plataforma). */
  protection: string | null;
}

const last = (u: URL) => u.pathname.split("/").filter(Boolean).pop() ?? "";

export const PLATFORMS: Platform[] = [
  {
    id: "olx", name: "OLX", sites: ["{uf}.olx.com.br"], kind: "classificados", sellsNew: false, isMarketplace: true, origin: "BR", protection: null,
    // anúncio: https://df.olx.com.br/distrito-federal-e-regiao/.../titulo-1458508492
    isItem: (u) => /^[a-z]{2}\.olx\.com\.br$/.test(u.hostname) && /-\d{8,11}$/.test(u.pathname),
    itemId: (u) => u.pathname.match(/(\d{8,11})$/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*\|\s*OLX.*$/i, "").replace(/\s+-\s+(Computadores e Desktops|Monitores|Peças e Componentes|Notebooks|Informática)[\s\S]*$/i, "").trim(),
    location: (u, t) => {
      const uf = u.hostname.slice(0, 2).toUpperCase();
      const m = t.match(/-\s+[^-]*?\(([^)]+)\),\s*([^|\d]+?)\s+\d{8,11}/) ?? t.match(/-\s+([^-|]+?),\s*([^|\d]+?)\s+\d{8,11}/);
      return m ? `${m[2].trim()}/${uf}` : uf;
    },
  },
  {
    id: "mercadolivre", name: "Mercado Livre", sites: ["produto.mercadolivre.com.br", "mercadolivre.com.br"], kind: "marketplace", sellsNew: false, isMarketplace: true, origin: "BR",
    protection: "Compra Garantida do Mercado Livre (pagando pela plataforma)",
    isItem: (u) => /mercadolivre\.com\.br$/.test(u.hostname) && (/MLB-?\d{6,}/i.test(u.pathname) || /\/p\/MLB\d+/i.test(u.pathname)) && !/^lista\./.test(u.hostname),
    itemId: (u) => (u.pathname.match(/MLB-?(\d{6,})/i)?.[1] ?? u.pathname),
    cleanTitle: (t) => t.replace(/\s*\|\s*(Parcelamento sem juros|MercadoLivre|Mercado Livre).*$/i, "").trim(),
  },
  {
    id: "amazon", name: "Amazon Brasil", sites: ["amazon.com.br"], kind: "marketplace", sellsNew: true, isMarketplace: true, origin: "BR", protection: "Garantia de A a Z da Amazon",
    isItem: (u) => /amazon\.com\.br$/.test(u.hostname) && /\/dp\/[A-Z0-9]{10}/.test(u.pathname),
    itemId: (u) => u.pathname.match(/\/dp\/([A-Z0-9]{10})/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*:\s*Amazon\.com\.br.*$/i, "").replace(/^Amazon\.com\.br\s*:\s*/i, "").trim(),
  },
  {
    id: "shopee", name: "Shopee", sites: ["shopee.com.br"], kind: "marketplace", sellsNew: false, isMarketplace: true, origin: "BR", protection: "Garantia Shopee (pagando pela plataforma)",
    isItem: (u) => /shopee\.com\.br$/.test(u.hostname) && /-i\.\d+\.\d+/.test(u.pathname),
    itemId: (u) => u.pathname.match(/-i\.(\d+\.\d+)/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*\|\s*Shopee.*$/i, "").replace(/\s*\.\.\.$/, "").trim(),
  },
  {
    id: "enjoei", name: "Enjoei", sites: ["enjoei.com.br"], kind: "classificados", sellsNew: false, isMarketplace: true, origin: "BR", protection: "Garantia Enjoei (pagando pela plataforma)",
    isItem: (u) => /enjoei\.com\.br$/.test(u.hostname) && /^\/p\//.test(u.pathname),
    itemId: (u) => last(u),
    cleanTitle: (t) => t.replace(/\s*\|\s*Enjoei.*$/i, "").trim(),
  },
  {
    id: "ebay", name: "eBay", sites: ["ebay.com"], kind: "marketplace", sellsNew: false, isMarketplace: true, origin: "INTL", protection: "eBay Money Back Guarantee (pagando pela plataforma)",
    isItem: (u) => /ebay\.com$/.test(u.hostname) && /^\/itm\/\d+/.test(u.pathname),
    itemId: (u) => u.pathname.match(/^\/itm\/(\d+)/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*\|\s*eBay.*$/i, "").trim(),
  },
  {
    id: "pichau", name: "Pichau", sites: ["pichau.com.br"], kind: "loja", sellsNew: true, isMarketplace: false, origin: "BR", protection: null,
    isItem: (u) => /pichau\.com\.br$/.test(u.hostname) && u.pathname.split("/").filter(Boolean).length === 1 && last(u).split("-").length >= 4,
    itemId: (u) => last(u),
    cleanTitle: (t) => t.replace(/\s*\|\s*Pichau.*$/i, "").trim(),
  },
  {
    id: "terabyte", name: "TerabyteShop", sites: ["terabyteshop.com.br"], kind: "loja", sellsNew: true, isMarketplace: false, origin: "BR", protection: null,
    isItem: (u) => /terabyteshop\.com\.br$/.test(u.hostname) && /^\/produto\/\d+/.test(u.pathname),
    itemId: (u) => u.pathname.match(/^\/produto\/(\d+)/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*-\s*TerabyteShop.*$/i, "").trim(),
  },
  {
    id: "magalu", name: "Magazine Luiza", sites: ["magazineluiza.com.br"], kind: "marketplace", sellsNew: true, isMarketplace: true, origin: "BR", protection: null,
    isItem: (u) => /magazineluiza\.com\.br$/.test(u.hostname) && /\/p\/[a-z0-9]+/i.test(u.pathname),
    itemId: (u) => u.pathname.match(/\/p\/([a-z0-9]+)/i)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*-\s*Magazine Luiza.*$/i, "").replace(/\s*\|\s*Magalu.*$/i, "").trim(),
  },
  {
    id: "casasbahia", name: "Casas Bahia", sites: ["casasbahia.com.br"], kind: "marketplace", sellsNew: true, isMarketplace: true, origin: "BR", protection: null,
    isItem: (u) => /casasbahia\.com\.br$/.test(u.hostname) && /\/p\/\d+/.test(u.pathname),
    itemId: (u) => u.pathname.match(/\/p\/(\d+)/)?.[1] ?? u.pathname,
    cleanTitle: (t) => t.replace(/\s*\|\s*Casas Bahia.*$/i, "").trim(),
  },
  {
    id: "carrefour", name: "Carrefour", sites: ["carrefour.com.br"], kind: "marketplace", sellsNew: true, isMarketplace: true, origin: "BR", protection: null,
    isItem: (u) => /carrefour\.com\.br$/.test(u.hostname) && /^\/produto\//.test(u.pathname),
    itemId: (u) => u.pathname.match(/-(\d{5,})\/?$/)?.[1] ?? last(u),
    cleanTitle: (t) => t.replace(/\s*\|\s*Carrefour.*$/i, "").trim(),
  },
  {
    id: "patoloco", name: "Patoloco", sites: ["patoloco.com.br"], kind: "loja", sellsNew: true, isMarketplace: false, origin: "BR", protection: null,
    isItem: (u) => /patoloco\.com\.br$/.test(u.hostname) && u.pathname.split("/").filter(Boolean).length === 1 && last(u).split("-").length >= 3 && !/busca|produtos/.test(u.pathname),
    itemId: (u) => last(u),
    cleanTitle: (t) => t.replace(/\s*-\s*Patoloco.*$/i, "").replace(/\s*\|\s*Patoloco.*$/i, "").trim(),
  },
  {
    id: "gkinfostore", name: "GK Infostore", sites: ["gkinfostore.com.br"], kind: "loja", sellsNew: true, isMarketplace: false, origin: "BR", protection: null,
    isItem: (u) => /gkinfostore\.com\.br$/.test(u.hostname) && u.pathname.split("/").filter(Boolean).length === 1 && last(u).split("-").length >= 4,
    itemId: (u) => last(u),
    cleanTitle: (t) => t.replace(/\s*-\s*GK Infostore.*$/i, "").replace(/\s*\|\s*GK.*$/i, "").trim(),
  },
];

/** Domínios que nunca são lojas (comparadores, notícias, redes sociais, vídeos). */
export const NOT_STORES = /(buscape|zoom\.com|google\.|youtube|facebook|instagram|tiktok|reddit|wikipedia|tecmundo|tecnoblog|olhardigital|canaltech|hardware\.com\.br|adrenaline|reclameaqui|techtudo|uol\.com|globo\.com|pelando|promobit|gatry|x\.com|twitter|pinterest|linkedin|mercadolivre\.com|olx\.com|amazon\.|shopee\.|kabum\.|pichau\.|terabyteshop\.|magazineluiza\.|casasbahia\.|carrefour\.|patoloco\.|gkinfostore\.|enjoei\.|ebay\.)/i;

/** Página de produto em domínio desconhecido: tem preço estruturado e não parece busca/categoria. */
export function looksLikeProductPage(u: URL, hasPrice: boolean): boolean {
  if (!hasPrice) return false;
  const p = (u.pathname + u.search).toLowerCase();
  if (/\/(busca|search|s|categoria|category|categorias|departamento|c|b|list|lista|tag|colecao|collections?)(\/|\?|$)|[?&](q|s|busca|search)=/.test(p)) return false;
  if (u.pathname === "/" || u.pathname.split("/").filter(Boolean).length === 0) return false;
  return true;
}

export function platformOf(hostname: string): Platform | null {
  return PLATFORMS.find((p) => p.sites.some((s) => hostname.endsWith(s.replace("{uf}.", "")))) ?? null;
}
