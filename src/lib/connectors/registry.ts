import { aliexpress } from "./aliexpress";
import { amazon } from "./amazon";
import { feeds } from "./feed";
import { kabum } from "./kabum";
import { mercadolivre } from "./mercadolivre";
import { shopee } from "./shopee";
import type { Connector } from "./types";

export const CONNECTORS: Connector[] = [kabum, mercadolivre, amazon, aliexpress, shopee, feeds];

export function activeConnectors(): Connector[] {
  return CONNECTORS.filter((c) => c.status().configured);
}

export function connectorById(id: string): Connector | undefined {
  if (id.startsWith("feed:")) return feeds;
  return CONNECTORS.find((c) => c.id === id);
}

/** Lojas que não têm conector ativo e o motivo (testado nesta implementação). */
export const UNSUPPORTED_STORES = [
  { store: "OLX", reason: "Sem API pública de busca (a API da OLX é para parceiros publicarem anúncios). Os termos de uso proíbem coleta automatizada. Integração possível só com parceria autorizada." },
  { store: "Facebook Marketplace", reason: "A Meta não oferece API de busca do Marketplace para terceiros. Integração só com autorização formal." },
  { store: "Enjoei", reason: "Sem API pública. Integração depende de autorização ou feed da plataforma." },
  { store: "Grupos, fóruns e classificados", reason: "Só com acesso permitido pelo administrador (feed/RSS). Use PRODUCT_FEEDS para importar listas autorizadas." },
  { store: "Pichau", reason: "Site protegido por anti-bot (HTTP 403 de Cloudflare em teste). Sem API pública. Use um feed de afiliado (PRODUCT_FEEDS)." },
  { store: "TerabyteShop", reason: "Site protegido por anti-bot (HTTP 403 em teste). Sem API pública. Use um feed de afiliado." },
  { store: "Magazine Luiza", reason: "Busca protegida (HTTP 403 em teste). API do Magalu é para vendedores, não para busca de catálogo. Use o feed do programa Parceiro Magalu/afiliados." },
  { store: "GK Infostore", reason: "HTTP 403 em teste. Sem API pública conhecida. Use feed, se a loja fornecer." },
  { store: "Patoloco", reason: "Conexão recusada em teste (domínio redireciona para patoloco.com.br, fora da lista liberada). Sem API pública conhecida." },
];
