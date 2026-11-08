/** Configuração central lida de variáveis de ambiente. */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export const config = {
  databaseUrl: env("DATABASE_URL") ?? "postgres://postgres:postgres@localhost:5432/pchunter",
  databaseSsl: env("DATABASE_SSL") === "true",
  cronSecret: env("CRON_SECRET"),
  /** Tempo (min) em que uma busca recente numa fonte é reaproveitada do banco. */
  searchCacheMinutes: Number(env("SEARCH_CACHE_MINUTES") ?? 30),
  /** Páginas por busca sob demanda / por atualização agendada. */
  onDemandPages: Number(env("ON_DEMAND_PAGES") ?? 2),
  cronPages: Number(env("CRON_PAGES") ?? 10),
  userAgent: env("SCRAPER_USER_AGENT") ?? "PCHunterBot/1.0 (+https://github.com/christiano76/teste-claude)",
  /** ICMS sobre importação usado na estimativa (conservador; varia por estado: 17% a 20%). */
  importIcmsRate: Number(env("IMPORT_ICMS_RATE") ?? 0.2),
  connectors: {
    kabum: { enabled: env("KABUM_ENABLED") !== "false" },
    mercadolivre: {
      accessToken: env("ML_ACCESS_TOKEN"),
      clientId: env("ML_CLIENT_ID"),
      clientSecret: env("ML_CLIENT_SECRET"),
      refreshToken: env("ML_REFRESH_TOKEN"),
    },
    amazon: {
      accessKey: env("AMAZON_PAAPI_ACCESS_KEY"),
      secretKey: env("AMAZON_PAAPI_SECRET_KEY"),
      partnerTag: env("AMAZON_PAAPI_PARTNER_TAG"),
      host: env("AMAZON_PAAPI_HOST") ?? "webservices.amazon.com.br",
      region: env("AMAZON_PAAPI_REGION") ?? "us-east-1",
    },
    aliexpress: {
      appKey: env("ALIEXPRESS_APP_KEY"),
      appSecret: env("ALIEXPRESS_APP_SECRET"),
      trackingId: env("ALIEXPRESS_TRACKING_ID"),
    },
    shopee: {
      appId: env("SHOPEE_AFFILIATE_APP_ID"),
      secret: env("SHOPEE_AFFILIATE_SECRET"),
    },
    /** Feeds de produtos (Google Merchant XML/CSV/JSON) de lojas/afiliados. JSON: [{"store":"Pichau","url":"https://..."}] */
    feeds: env("PRODUCT_FEEDS"),
  },
  email: {
    resendApiKey: env("RESEND_API_KEY"),
    from: env("ALERT_EMAIL_FROM") ?? "PC Hunter <alertas@example.com>",
  },
  appUrl: env("APP_URL") ?? "http://localhost:3000",
  brave: {
    /** Chave da Brave Search API — só no servidor (.env.local / variáveis da hospedagem). */
    apiKey: env("BRAVE_SEARCH_API_KEY"),
    /** Validade do cache de respostas (h). */
    cacheHours: Number(env("BRAVE_CACHE_HOURS") ?? 12),
    /** Máximo de consultas à Brave por busca do usuário (controle de custo). */
    maxQueriesPerSearch: Number(env("BRAVE_MAX_QUERIES_PER_SEARCH") ?? 40),
    /** Requisições por segundo (respeita o limite do plano). */
    rps: Number(env("BRAVE_RPS") ?? 5),
  },
  defaultCep: env("DEFAULT_CEP") ?? null,
};
