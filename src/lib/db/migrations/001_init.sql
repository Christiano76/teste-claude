-- PC Hunter — esquema inicial (PostgreSQL 14+ / Supabase)

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS stores (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  domain            TEXT,
  reputation        INT,            -- 0..100 (base curada; NULL = desconhecida)
  reputation_basis  TEXT,
  ships_from        TEXT,           -- 'BR' | 'INTL' | 'mixed'
  is_marketplace    BOOLEAN,
  discovered_via    TEXT,           -- 'seed' ou id do conector que a encontrou
  discovered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  offers_seen       INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offers (
  id                   BIGSERIAL PRIMARY KEY,
  source               TEXT NOT NULL,
  external_id          TEXT NOT NULL,
  store_slug           TEXT NOT NULL REFERENCES stores(slug),
  store_name           TEXT NOT NULL,
  seller_name          TEXT,
  title                TEXT NOT NULL,
  title_norm           TEXT NOT NULL,
  url                  TEXT NOT NULL,
  image_url            TEXT,
  category             TEXT NOT NULL CHECK (category IN ('pc','monitor')),
  price                NUMERIC(12,2) NOT NULL,
  installment_price    NUMERIC(12,2),
  list_price           NUMERIC(12,2),
  currency             TEXT NOT NULL DEFAULT 'BRL',
  available            BOOLEAN,
  stock_qty            INT,
  is_marketplace       BOOLEAN,
  seller_rating        NUMERIC(3,2),
  seller_rating_count  INT,
  product_rating       NUMERIC(3,2),
  product_rating_count INT,
  warranty_text        TEXT,
  free_shipping        BOOLEAN,
  shipping_cost        NUMERIC(10,2),
  delivery_min         INT,
  delivery_max         INT,
  delivery_source      TEXT,
  origin               TEXT CHECK (origin IN ('BR','INTL')),
  taxes_included       BOOLEAN,
  condition            TEXT,
  brand                TEXT,
  seller_location      TEXT,
  specs                JSONB NOT NULL,
  specs_text           TEXT,
  canonical_key        TEXT NOT NULL,
  -- colunas desnormalizadas para filtros rápidos
  cpu_model            TEXT,
  cpu_index            NUMERIC(6,1),
  gpu_model            TEXT,
  gpu_index            NUMERIC(6,1),
  ram_gb               INT,
  storage_gb           INT,
  includes_monitor     BOOLEAN,
  res_label            TEXT,
  refresh_hz           INT,
  size_in              NUMERIC(4,1),
  panel                TEXT,
  first_seen_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  details_fetched_at   TIMESTAMPTZ,
  active               BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (source, external_id)
);

CREATE INDEX IF NOT EXISTS offers_category_idx ON offers (category, active, price);
CREATE INDEX IF NOT EXISTS offers_canonical_idx ON offers (canonical_key);
CREATE INDEX IF NOT EXISTS offers_title_trgm ON offers USING gin (title_norm gin_trgm_ops);
CREATE INDEX IF NOT EXISTS offers_store_idx ON offers (store_slug);

CREATE TABLE IF NOT EXISTS price_snapshots (
  id           BIGSERIAL PRIMARY KEY,
  offer_id     BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  price        NUMERIC(12,2) NOT NULL,
  list_price   NUMERIC(12,2),
  available    BOOLEAN,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS snapshots_offer_idx ON price_snapshots (offer_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS search_runs (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  query        TEXT NOT NULL,
  category     TEXT NOT NULL,
  trigger      TEXT NOT NULL DEFAULT 'on-demand', -- 'on-demand' | 'cron'
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at  TIMESTAMPTZ,
  status       TEXT NOT NULL DEFAULT 'running',  -- running | ok | error | skipped
  items        INT NOT NULL DEFAULT 0,
  error        TEXT
);
CREATE INDEX IF NOT EXISTS search_runs_lookup ON search_runs (source, category, query, started_at DESC);

-- Sessões anônimas: guardamos apenas o hash SHA-256 do token do cookie.
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  offer_id    BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  price_at_save NUMERIC(12,2),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, offer_id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id              BIGSERIAL PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  offer_id        BIGINT REFERENCES offers(id) ON DELETE CASCADE,
  canonical_key   TEXT,            -- alerta vale para o mesmo produto em qualquer loja
  target_price    NUMERIC(12,2) NOT NULL,
  email           TEXT,            -- opcional; nunca dados de pagamento
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_at    TIMESTAMPTZ,
  triggered_price NUMERIC(12,2)
);
CREATE INDEX IF NOT EXISTS alerts_active_idx ON alerts (active);

CREATE TABLE IF NOT EXISTS notifications (
  id          BIGSERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  alert_id    BIGINT REFERENCES alerts(id) ON DELETE SET NULL,
  offer_id    BIGINT REFERENCES offers(id) ON DELETE CASCADE,
  message     TEXT NOT NULL,
  price       NUMERIC(12,2),
  emailed     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS shipping_quotes (
  offer_id    BIGINT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  cep         TEXT NOT NULL,
  cost        NUMERIC(10,2),
  min_days    INT,
  max_days    INT,
  source      TEXT NOT NULL,
  quoted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (offer_id, cep)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Supabase: o acesso é feito apenas pelo backend (conexão direta/service role).
-- Habilitar RLS sem políticas bloqueia acesso pela API pública (anon key).
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
