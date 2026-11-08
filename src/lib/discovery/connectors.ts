/**
 * Conectores de DESCOBERTA via Brave Search API: um por plataforma (operador site:)
 * e um de descoberta aberta (lojas desconhecidas).
 * Resultados vêm do índice do buscador: o preço é o indexado (NÃO confirmado),
 * estoque e frete ficam "não verificados". Só páginas de anúncio individual viram ofertas.
 */
import { createHash } from "crypto";
import { config } from "../config";
import { query } from "../db";
import { detectCategory } from "../hardware/specs";
import { classifyCondition } from "../market/condition";
import type { Category, RawOffer } from "../types";
import { type Connector, emptyOffer, type SearchPage, type SearchParams } from "../connectors/types";
import { braveSearch, cleanText, type BraveResult } from "./brave";
import { looksLikeProductPage, NOT_STORES, PLATFORMS, type Platform } from "./platforms";

/** Nomes alternativos por categoria — o garimpo não depende do nome exato. */
const VARIANTS: Record<Category, string[]> = {
  pc: ["computador completo", "pc gamer", "cpu desktop i5", "computador usado i3 i5", "dell optiplex hp prodesk lenovo thinkcentre", "pc escritório"],
  monitor: ["monitor", "monitor 24 polegadas", "monitor usado", "monitor full hd 75hz"],
  kit: ["kit upgrade processador placa mãe memória", "kit xeon x99 placa mãe"],
  peca: ["placa de vídeo", "processador", "memória ram ddr4", "ssd 480gb"],
};

export function buildQueries(category: Category, text: string, maxPrice: number | undefined, n: number): string[] {
  const t = text.trim();
  const cheap = maxPrice != null && maxPrice <= 1200;
  let qs: string[];
  if (t) {
    const word = category === "monitor" ? "monitor" : category === "pc" ? "computador" : "";
    const base = word && !t.toLowerCase().includes(word) && !/\b(pc|cpu|desktop)\b/i.test(t) ? `${word} ${t}` : t;
    qs = [base, `${base} usado`, ...VARIANTS[category]];
  } else {
    qs = [...VARIANTS[category]];
  }
  if (cheap) {
    qs = qs.map((q, i) => (i === 1 && !/usad|barat/.test(q) ? `${q} barato` : q));
    qs.splice(2, 0, `${qs[0]} usado barato`);
  }
  return [...new Set(qs)].slice(0, n);
}

function parseIndexedAt(r: BraveResult): string | null {
  const v = r.page_age ?? r.age;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function priceFrom(r: BraveResult, desc: string): { price: number; source: string } | null {
  const p = Number(r.product?.price);
  if (Number.isFinite(p) && p > 0) return { price: p, source: "dados estruturados do anúncio, indexados pela Brave" };
  // um único valor em R$ no trecho do próprio anúncio
  const vals = [...new Set([...desc.matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)/g)].map((m) => Number(m[1].replace(/\./g, "").replace(",", "."))))];
  if (vals.length === 1 && vals[0] > 0) return { price: vals[0], source: "valor no trecho do anúncio indexado pela Brave" };
  return null;
}

export interface Mapped { offer: RawOffer | null; listing: { url: string; platform: string; domain: string; title: string; snippet: string; image: string | null; category: Category; location: string | null; indexedAt: string | null } | null }

/** Converte um resultado da Brave em oferta (com preço) ou anúncio sem preço; ignora listagens. */
export function mapBraveResult(r: BraveResult, platform: Platform | null): Mapped {
  let u: URL;
  try { u = new URL(r.url); } catch { return { offer: null, listing: null }; }
  const hasPrice = Number(r.product?.price) > 0;
  const isItem = platform ? platform.isItem(u) : looksLikeProductPage(u, hasPrice) && !NOT_STORES.test(u.hostname);
  if (!isItem) return { offer: null, listing: null };
  const rawTitle = cleanText(r.title);
  const title = platform?.cleanTitle ? platform.cleanTitle(rawTitle) : rawTitle.replace(/\s*[|–-]\s*[^|–-]{2,40}$/, "").trim();
  if (title.length < 6) return { offer: null, listing: null };
  const desc = cleanText([r.description, ...(r.extra_snippets ?? [])].filter(Boolean).join(" · ")).slice(0, 1500);
  const category = detectCategory(title, null);
  const location = platform?.location ? platform.location(u, rawTitle) : null;
  const indexedAt = parseIndexedAt(r);
  const image = r.product?.thumbnail?.src ?? r.thumbnail?.src ?? null;
  const domain = u.hostname.replace(/^www\./, "");
  const pr = priceFrom(r, desc);
  // preço "sob consulta" (99999,90 etc.) ou absurdo não é preço
  const placeholder = pr != null && (/^9{4,}/.test(String(Math.floor(pr.price))) || pr.price > 60000);
  if (!pr || pr.price < 30 || placeholder) {
    return { offer: null, listing: { url: r.url, platform: platform?.name ?? domain, domain, title, snippet: desc.slice(0, 400), image, category, location, indexedAt } };
  }
  const sourceId = platform ? `brave-${platform.id}` : "brave-web";
  const offer: RawOffer = {
    ...emptyOffer({
      source: sourceId,
      externalId: platform ? platform.itemId(u) : createHash("sha1").update(r.url).digest("hex").slice(0, 16),
      title,
      url: r.url,
      price: pr.price,
      storeName: platform?.name ?? domain,
    }),
    imageUrl: image,
    available: null, // estoque NÃO confirmado
    isMarketplace: platform?.isMarketplace ?? null,
    sellerType: platform?.kind === "loja" ? "loja" : null,
    sellerLocation: location,
    origin: platform?.origin ?? (domain.endsWith(".br") ? "BR" : null),
    taxesIncluded: platform?.origin === "INTL" ? false : true,
    protection: platform?.protection ?? null,
    condition: classifyCondition(title, desc, null, { storeSellsNewByDefault: platform?.sellsNew ?? false }),
    categoryHint: category,
    specsText: desc,
    verification: "indice-busca",
    priceSource: pr.source + (indexedAt ? ` em ${new Date(indexedAt).toLocaleDateString("pt-BR")}` : ""),
    indexedAt,
    platform: platform?.name ?? domain,
  };
  return { offer, listing: null };
}

async function saveListings(rows: NonNullable<Mapped["listing"]>[], q: string) {
  for (const l of rows) {
    await query(
      `INSERT INTO discovered_listings (url, platform, domain, title, snippet, image_url, category, location, query, indexed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (url) DO UPDATE SET title=EXCLUDED.title, snippet=EXCLUDED.snippet, image_url=COALESCE(EXCLUDED.image_url, discovered_listings.image_url), last_seen_at=now()`,
      [l.url, l.platform, l.domain, l.title, l.snippet, l.image, l.category, l.location, q, l.indexedAt],
    );
  }
}

/** UF padrão: do CEP padrão do projeto (DEFAULT_CEP), usado quando o usuário não informa CEP. */
function ufFromCep(cep: string | null): string | null {
  if (!cep) return null;
  const p = Number(cep.replace(/\D/g, "").slice(0, 5));
  const R: [number, number, string][] = [[1000,19999,"sp"],[20000,28999,"rj"],[29000,29999,"es"],[30000,39999,"mg"],[40000,48999,"ba"],[49000,49999,"se"],[50000,56999,"pe"],[57000,57999,"al"],[58000,58999,"pb"],[59000,59999,"rn"],[60000,63999,"ce"],[64000,64999,"pi"],[65000,65999,"ma"],[66000,68899,"pa"],[68900,68999,"ap"],[69000,69299,"am"],[69300,69399,"rr"],[69400,69899,"am"],[69900,69999,"ac"],[70000,72799,"df"],[72800,72999,"go"],[73000,73699,"df"],[73700,76799,"go"],[76800,76999,"ro"],[77000,77999,"to"],[78000,78899,"mt"],[79000,79999,"ms"],[80000,87999,"pr"],[88000,89999,"sc"],[90000,99999,"rs"]];
  return R.find(([a, b]) => p >= a && p <= b)?.[2] ?? null;
}
export { ufFromCep };

const QUERIES_PER_PLATFORM = 2;

/** UFs vizinhas (OLX é regional): ampliam o garimpo sem perder a chance de retirada/entrega próxima. */
const NEIGHBORS: Record<string, string[]> = {
  df: ["go", "mg"], go: ["df", "mg"], sp: ["rj", "mg"], rj: ["sp", "mg"], mg: ["sp", "rj"], pr: ["sc", "sp"], sc: ["pr", "rs"], rs: ["sc"],
  ba: ["se", "pe"], pe: ["pb", "al"], ce: ["rn", "pi"], es: ["rj", "mg"], ms: ["sp", "pr"], mt: ["go", "ms"],
};

function makeConnector(p: Platform): Connector {
  return {
    id: `brave-${p.id}`,
    name: `${p.name} (via Brave Search)`,
    stores: [p.name],
    kind: "search-index",
    evidence: "Busca real pela Brave Search API com operador site:. Só páginas de anúncio individual são usadas; o preço é o indexado pelo buscador (não confirmado).",
    status() {
      const configured = !!config.brave.apiKey;
      return {
        configured,
        state: configured ? "unverified" : "needs-credentials",
        message: configured
          ? `Descoberta de anúncios de ${p.name} no índice da Brave (site:${p.sites[0].replace("{uf}", "<uf>")}). Preço e estoque não são confirmados na plataforma; frete não verificado.`
          : "Requer BRAVE_SEARCH_API_KEY no servidor.",
        requires: ["BRAVE_SEARCH_API_KEY"],
        docsUrl: "https://api-dashboard.search.brave.com/app/documentation/web-search",
      };
    },
    async search(sp: SearchParams): Promise<SearchPage> {
      const uf = sp.uf?.toLowerCase() ?? ufFromCep(config.defaultCep) ?? "sp";
      // orçamento baixo: uma consulta extra ("usado barato") por plataforma
      const n = QUERIES_PER_PLATFORM + (sp.maxPrice != null && sp.maxPrice <= 1200 ? 1 : 0);
      const qs = buildQueries(sp.category, sp.query, sp.maxPrice, n);
      const plan: string[] = [];
      if (p.sites[0].includes("{uf}")) {
        for (const q of qs) plan.push(`${q} site:${p.sites[0].replace("{uf}", uf)}`);
        for (const nb of NEIGHBORS[uf] ?? []) plan.push(`${qs[0]} site:${p.sites[0].replace("{uf}", nb)}`);
      } else {
        for (const q of qs) plan.push(`${q} site:${p.sites[0]}`);
      }
      const offers: RawOffer[] = [];
      let full = false;
      for (const fullQ of plan) {
        const q = fullQ.replace(/ site:\S+$/, "");
        const { results } = await braveSearch({ q: fullQ, offset: sp.page - 1 });
        if (results.length >= 18) full = true;
        const listings: NonNullable<Mapped["listing"]>[] = [];
        for (const r of results) {
          const m = mapBraveResult(r, p);
          if (m.offer) offers.push(m.offer);
          if (m.listing) listings.push(m.listing);
        }
        await saveListings(listings, q);
      }
      return { offers, hasMore: full && sp.page < 2 };
    },
  };
}

export const BRAVE_PLATFORM_CONNECTORS: Connector[] = PLATFORMS.map(makeConnector);

/** Termos com modelos comuns em lojas pequenas de usados/recondicionados. */
const DISCOVERY_VARIANTS: Record<Category, string[]> = {
  pc: ["dell optiplex i5 usado", "computador completo i5 usado", "lenovo thinkcentre hp elitedesk usado", "pc gamer usado"],
  monitor: ["monitor 19 polegadas usado", "monitor 22 polegadas usado", "monitor 24 polegadas usado"],
  kit: ["kit placa mãe processador memória usado"],
  peca: ["placa de vídeo usada", "processador usado"],
};
const EXCLUDE = ["mercadolivre.com.br", "olx.com.br", "amazon.com.br", "shopee.com.br", "buscape.com.br", "magazineluiza.com.br", "casasbahia.com.br", "zoom.com.br", "kabum.com.br"].map((d) => `-site:${d}`).join(" ");

/** Página de produto (mesmo sem preço) em loja desconhecida. */
function productPathish(u: URL): boolean {
  const p = u.pathname.toLowerCase();
  if (/\/(busca|search|categoria|category|product-category|categoria-produto|tag|marca|colecao|collections?)\b|[?&](q|s|busca)=/.test(p + u.search)) return false;
  return /(\/p\/?$|\/produto\/|\/prod-\d|\/product\/|\/item\/|-\d{4,}\/?$)/.test(p) || (p.split("/").filter(Boolean).length <= 2 && (p.match(/-/g)?.length ?? 0) >= 4);
}

/** Descoberta aberta: consultas com modelos comuns, excluindo marketplaces já cobertos, para achar lojas pequenas. */
export const braveDiscovery: Connector = {
  id: "brave-web",
  name: "Descoberta de lojas (Brave Search)",
  stores: [],
  kind: "search-index",
  evidence: "Consultas abertas na Brave Search API (com -site: dos marketplaces já cobertos); domínios novos com página de produto entram como lojas descobertas.",
  status() {
    const configured = !!config.brave.apiKey;
    return { configured, state: configured ? "unverified" : "needs-credentials", message: configured ? "Encontra produtos em lojas pequenas e desconhecidas (preço do índice, não confirmado; sem preço → \"anúncio encontrado\")." : "Requer BRAVE_SEARCH_API_KEY.", requires: ["BRAVE_SEARCH_API_KEY"], docsUrl: "https://api-dashboard.search.brave.com/app/documentation/web-search" };
  },
  async search(sp: SearchParams): Promise<SearchPage> {
    const base = sp.query.trim() ? [`${buildQueries(sp.category, sp.query, sp.maxPrice, 1)[0]} usado`] : DISCOVERY_VARIANTS[sp.category].slice(0, 2);
    const offers: RawOffer[] = [];
    for (const q of base) {
      const { results } = await braveSearch({ q: `${q} ${EXCLUDE}`, offset: sp.page - 1 });
      const listings: NonNullable<Mapped["listing"]>[] = [];
      for (const r of results) {
        let u: URL;
        try { u = new URL(r.url); } catch { continue; }
        if (NOT_STORES.test(u.hostname)) continue;
        const m = mapBraveResult(r, null);
        if (m.offer) { offers.push(m.offer); continue; }
        // sem preço estruturado: guarda como anúncio encontrado se a URL é de produto
        if (productPathish(u)) {
          const title = cleanText(r.title).replace(/\s*[|–]\s*[^|–]{2,40}$/, "").trim();
          const domain = u.hostname.replace(/^www\./, "");
          listings.push({ url: r.url, platform: domain, domain, title, snippet: cleanText(r.description).slice(0, 400), image: r.thumbnail?.src ?? null, category: detectCategory(title, null), location: null, indexedAt: parseIndexedAt(r) });
          await query(`INSERT INTO stores (slug, name, domain, discovered_via) VALUES ($1,$2,$3,'brave-web') ON CONFLICT (slug) DO NOTHING`, [domain.replace(/[^a-z0-9]+/g, "-").slice(0, 60), domain, domain]);
        }
      }
      await saveListings(listings, q);
    }
    return { offers, hasMore: false };
  },
};
