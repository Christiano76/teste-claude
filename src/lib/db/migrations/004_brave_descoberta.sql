-- Descoberta via Brave Search API, verificação de preço, peças avulsas, preferências e log de buscas

-- Como o preço foi obtido: 'api' (confirmado na fonte) ou 'indice-busca' (dado indexado pelo buscador, não confirmado)
ALTER TABLE offers ADD COLUMN IF NOT EXISTS verification TEXT NOT NULL DEFAULT 'api';
ALTER TABLE offers ADD COLUMN IF NOT EXISTS price_source TEXT;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS indexed_at TIMESTAMPTZ;
ALTER TABLE offers ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE offers DROP CONSTRAINT IF EXISTS offers_category_check;
ALTER TABLE offers ADD CONSTRAINT offers_category_check CHECK (category IN ('pc','monitor','kit','peca'));
CREATE INDEX IF NOT EXISTS offers_verification_idx ON offers (category, verification, active);

-- Cache das respostas da Brave (reduz consumo da API)
CREATE TABLE IF NOT EXISTS search_cache (
  key         TEXT PRIMARY KEY,           -- provedor + consulta + parâmetros
  provider    TEXT NOT NULL,
  query       TEXT NOT NULL,
  response    JSONB NOT NULL,
  status      INT NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS search_cache_age ON search_cache (fetched_at);

-- Anúncios individuais encontrados SEM preço no índice (exibidos como "anúncio encontrado, preço não informado")
CREATE TABLE IF NOT EXISTS discovered_listings (
  url          TEXT PRIMARY KEY,
  platform     TEXT NOT NULL,
  domain       TEXT NOT NULL,
  title        TEXT NOT NULL,
  snippet      TEXT,
  image_url    TEXT,
  category     TEXT,
  location     TEXT,
  query        TEXT,
  indexed_at   TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discovered_cat_idx ON discovered_listings (category, last_seen_at DESC);

-- Log de buscas executadas pelo usuário (resultados agregados, sem dados pessoais)
CREATE TABLE IF NOT EXISTS search_log (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  mode        TEXT NOT NULL,
  query       TEXT,
  budget      NUMERIC(12,2),
  uf          TEXT,
  results     INT NOT NULL DEFAULT 0,
  sources     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Preferências do usuário (sessão anônima)
CREATE TABLE IF NOT EXISTS user_preferences (
  session_id  TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  cep         TEXT,
  theme       TEXT CHECK (theme IN ('dark','light')),
  filters     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase: acesso só pelo backend; RLS ativo e sem políticas bloqueia a API pública (anon key)
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovered_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Leitura pública somente de dados de produtos (nunca sessões, alertas ou preferências), caso o front use a anon key
DROP POLICY IF EXISTS offers_public_read ON offers;
CREATE POLICY offers_public_read ON offers FOR SELECT USING (active);
DROP POLICY IF EXISTS stores_public_read ON stores;
CREATE POLICY stores_public_read ON stores FOR SELECT USING (true);
DROP POLICY IF EXISTS snapshots_public_read ON price_snapshots;
CREATE POLICY snapshots_public_read ON price_snapshots FOR SELECT USING (true);
