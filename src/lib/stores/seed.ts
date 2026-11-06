import { query } from "../db";

/**
 * Lojas conhecidas. `reputation` é uma BASE CURADA inicial (0–100) que combina
 * tempo de mercado, política de trocas e histórico conhecido de atendimento.
 * Não é nota oficial de nenhum site de reclamações: ajuste conforme sua própria
 * verificação (ex.: Reclame Aqui) — o campo `reputation_basis` explica a origem.
 * Vendedores de marketplace recebem nota própria calculada a partir das avaliações.
 */
export const STORE_SEED = [
  { slug: "kabum", name: "KaBuM!", domain: "kabum.com.br", reputation: 82, ships_from: "BR", is_marketplace: true },
  { slug: "pichau", name: "Pichau", domain: "pichau.com.br", reputation: 80, ships_from: "BR", is_marketplace: false },
  { slug: "terabyte", name: "TerabyteShop", domain: "terabyteshop.com.br", reputation: 82, ships_from: "BR", is_marketplace: false },
  { slug: "amazon-br", name: "Amazon Brasil", domain: "amazon.com.br", reputation: 86, ships_from: "mixed", is_marketplace: true },
  { slug: "mercadolivre", name: "Mercado Livre", domain: "mercadolivre.com.br", reputation: 75, ships_from: "mixed", is_marketplace: true },
  { slug: "magalu", name: "Magazine Luiza", domain: "magazineluiza.com.br", reputation: 78, ships_from: "BR", is_marketplace: true },
  { slug: "shopee", name: "Shopee", domain: "shopee.com.br", reputation: 60, ships_from: "mixed", is_marketplace: true },
  { slug: "aliexpress", name: "AliExpress", domain: "aliexpress.com", reputation: 62, ships_from: "INTL", is_marketplace: true },
  { slug: "gkinfostore", name: "GK Infostore", domain: "gkinfostore.com.br", reputation: 72, ships_from: "BR", is_marketplace: false },
  { slug: "patoloco", name: "Patoloco", domain: "patoloco.com.br", reputation: 70, ships_from: "BR", is_marketplace: false },
] as const;

export async function seedStores(): Promise<void> {
  for (const s of STORE_SEED) {
    await query(
      `INSERT INTO stores (slug, name, domain, reputation, reputation_basis, ships_from, is_marketplace, discovered_via)
       VALUES ($1,$2,$3,$4,'base curada inicial (ajustável)',$5,$6,'seed')
       ON CONFLICT (slug) DO NOTHING`,
      [s.slug, s.name, s.domain, s.reputation, s.ships_from, s.is_marketplace],
    );
  }
}
