/**
 * Tipos de domínio do PC Hunter.
 *
 * Regra de ouro: campos desconhecidos são `null`, nunca um valor "chutado".
 * A interface exibe "não verificado" para qualquer `null`.
 */

/** pc = computador completo; monitor; kit = kit de hardware (processador + placa-mãe ± memória). */
export type Category = "pc" | "monitor" | "kit" | "peca";
export type PartKind = "gpu" | "cpu" | "ram" | "ssd" | "placa-mae" | "fonte";
/** api = preço confirmado na fonte; indice-busca = dado do índice de um buscador (não confirmado). */
export type Verification = "api" | "indice-busca";
export type SearchMode = "pc" | "pc-monitor" | "monitor" | "kit" | "peca" | "garimpo-entrega";
export type Origin = "BR" | "INTL";
/** Estado de conservação (6 classes). */
export type Condition = "novo" | "seminovo" | "usado" | "recondicionado" | "mostruario" | "nao-informado";
/** loja = a própria loja vende; profissional = vendedor PJ/marketplace; pessoa-fisica = particular. */
export type SellerType = "loja" | "profissional" | "pessoa-fisica";
export type RiskLevel = "baixo" | "atencao" | "alto" | "insuficiente";

export interface DeliveryEstimate {
  minDays: number;
  maxDays: number;
  /** De onde veio o prazo (ex.: "api-mercadolivre"). Só preenchido se a fonte informou. */
  source: string;
}

/** Oferta como vem do conector, já em formato comum, antes da análise. */
export interface RawOffer {
  source: string; // id do conector (ex.: "kabum")
  externalId: string; // id do produto na fonte
  title: string;
  url: string;
  imageUrl: string | null;
  /** Preço à vista (PIX/boleto) na moeda `currency`. */
  price: number;
  /** Preço parcelado/cheio, se diferente do à vista. */
  installmentPrice: number | null;
  /** Preço "de" anunciado pela loja (pode ser inflado — verificado no histórico). */
  listPrice: number | null;
  currency: "BRL" | "USD";
  available: boolean | null;
  stockQty: number | null;
  storeName: string; // loja/marketplace (ex.: "KaBuM!")
  sellerName: string | null; // vendedor (marketplace)
  isMarketplace: boolean | null;
  sellerRating: number | null; // 0..5
  sellerRatingCount: number | null;
  productRating: number | null; // 0..5
  productRatingCount: number | null;
  warrantyText: string | null;
  freeShipping: boolean | null;
  shippingCost: number | null; // em BRL, se a fonte calculou
  delivery: DeliveryEstimate | null;
  origin: Origin | null;
  /** Impostos de importação já inclusos no preço (ex.: checkout Remessa Conforme). */
  taxesIncluded: boolean | null;
  condition: Condition | null;
  sellerType: SellerType | null;
  /** Retirada presencial disponível (null = não informado). */
  pickup: boolean | null;
  /** Envio confirmado pela fonte (true), sem envio (false) ou não confirmado (null). */
  shipAvailable: boolean | null;
  /** Alcance do envio: nacional, só para a cidade/região, ou internacional. */
  shipScope: "nacional" | "local" | "internacional" | null;
  /** Programa de envio da plataforma (ex.: "Mercado Envios Full", "Entrega Fácil OLX"). */
  shipProgram: string | null;
  /** Proteção ao comprador da plataforma (ex.: "Compra Garantida", "Garantia OLX"). */
  protection: string | null;
  verification: Verification;
  /** Origem do preço (ex.: "dados estruturados do anúncio indexados pela Brave"). */
  priceSource: string | null;
  /** Quando o buscador indexou a página (só para verification = indice-busca). */
  indexedAt: string | null;
  /** Plataforma de origem (OLX, Mercado Livre, Amazon...). */
  platform: string | null;
  brand: string | null;
  categoryHint: Category | null;
  /** Texto extra com especificações (descrição/ficha técnica). */
  specsText: string | null;
  sellerLocation: string | null; // UF/cidade do vendedor
}

export interface CpuInfo {
  model: string;
  vendor: "amd" | "intel" | "other";
  /** Índice de desempenho em jogos (Ryzen 5 5600 = 100). null = modelo não reconhecido. */
  index: number | null;
  integratedGpu: string | null;
  generationAge: "current" | "recent" | "old" | "obsolete" | null;
  socket: string | null;
}

export interface GpuInfo {
  model: string;
  vramGb: number | null;
  integrated: boolean;
  /** Índice relativo de desempenho (RTX 4060 = 100). */
  index: number | null;
}

export interface StorageInfo {
  type: "nvme" | "ssd" | "hdd" | "emmc" | "unknown";
  gb: number;
}

export interface PsuInfo {
  watts: number | null;
  rating: string | null; // "80 Plus Bronze", etc.
  certified: boolean | null;
}

export interface MonitorSpecs {
  sizeIn: number | null;
  width: number | null;
  height: number | null;
  resolutionLabel: string | null; // "1080p" | "1440p" | "4K" | "ultrawide-1440p"...
  refreshHz: number | null;
  panel: "IPS" | "VA" | "TN" | "OLED" | "QD-OLED" | "Mini-LED" | null;
  responseMs: number | null;
  curved: boolean | null;
  hdr: string | null;
  adaptiveSync: string | null; // "FreeSync Premium", "G-Sync Compatible"...
  ports: string[];
}

export interface PcSpecs {
  cpu: CpuInfo | null;
  gpu: GpuInfo | null;
  ramGb: number | null;
  ramType: "DDR3" | "DDR4" | "DDR5" | null;
  storage: StorageInfo[];
  psu: PsuInfo | null;
  motherboard: { chipset: string | null; socket: string | null } | null;
  os: string | null;
  includesMonitor: boolean;
  monitor: MonitorSpecs | null;
  includesPeripherals: boolean;
}

export interface PartSpecs {
  kind: PartKind;
  model: string | null;
  /** Índice de desempenho (GPU: RTX 4060 = 100; CPU: Ryzen 5 5600 = 100). */
  index: number | null;
  /** Capacidade (RAM/SSD em GB) ou potência (fonte, W). */
  capacity: number | null;
  detail: string | null;
}

export interface ParsedSpecs {
  category: Category;
  part?: PartSpecs | null;
  pc: PcSpecs | null;
  monitor: MonitorSpecs | null;
  /** Campos que o parser não conseguiu identificar. */
  missing: string[];
}

/** Oferta persistida (linha da tabela `offers` + especificações). */
export interface Offer extends RawOffer {
  id: number;
  category: Category;
  specs: ParsedSpecs;
  canonicalKey: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastCheckedAt: string;
}

export interface CostBreakdown {
  productPrice: number; // BRL
  shipping: number | null; // null = não verificado
  importTax: number | null; // II
  icms: number | null;
  total: number; // soma do que é conhecido
  totalIsComplete: boolean; // false se frete desconhecido
  notes: string[];
  fxRate: number | null;
}

export interface ScoreComponent {
  key: string;
  label: string;
  weight: number;
  value: number; // 0..100
  detail: string;
}

export type Verdict = "excelente" | "muito-bom" | "razoavel" | "pouco-recomendado";

export interface Flag {
  level: "info" | "warn" | "danger";
  code: string;
  message: string;
}

export interface Analysis {
  score: number;
  verdict: Verdict;
  components: ScoreComponent[];
  flags: Flag[];
  cost: CostBreakdown;
  performance: {
    gamingIndex: number | null; // índice efetivo (RTX4060 + R5 5600 ≈ 100)
    tierLabel: string | null;
    perResolution: { res: string; label: string }[];
    bottleneck: string | null;
  } | null;
  monitorQuality: number | null;
  storeReputation: { score: number; label: string; basis: string };
  priceInsight: PriceInsight | null;
  suspicious: boolean;
  delivery: {
    mode: "envio-nacional" | "envio-local" | "internacional" | "retirada" | "sem-envio" | "nao-confirmado";
    /** true = envio confirmado para o comprador; false = não entrega; null = não confirmado. */
    deliverable: boolean | null;
    label: string;
    program: string | null;
    protection: string | null;
    pickup: boolean | null;
    /** Vendedor na mesma UF do comprador (retirada/entrega local possível — a combinar). */
    nearBuyer?: boolean;
  };
  /** Adequação por uso (estimativa) — só para PCs. */
  usage: { use: string; level: "adequado" | "limitado" | "nao-recomendado" | "nao-verificavel"; note: string }[] | null;
  verification: Verification;
  condition: Condition;
  market: MarketEstimate;
  risk: { level: RiskLevel; reasons: string[] };
  scores: { custoBeneficio: number; desconto: number | null; confiabilidade: number; geral: number };
  scoreNotes: { custoBeneficio: string; desconto: string; confiabilidade: string };
}

export interface MarketEstimate {
  /** Preço médio de mercado estimado para este produto NESTE estado de conservação. */
  price: number | null;
  /** Preço médio do equivalente novo. */
  newPrice: number | null;
  comparables: number;
  basis: string;
  /** Desconto real (0.3 = 30% abaixo do mercado). Negativo = acima do mercado. */
  discount: number | null;
  savings: number | null;
}

export interface PriceInsight {
  samples: number;
  daysCovered: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  current: number;
  /** "otimo" = perto do mínimo histórico; "alto" = acima da média. */
  position: "otimo" | "bom" | "medio" | "alto" | "insuficiente";
  fakeDiscount: boolean;
  message: string;
}

export interface AnalyzedOffer {
  offer: Offer;
  analysis: Analysis;
  alsoAt: { store: string; price: number; offerId: number }[];
}

export interface ComboResult {
  kind: "kit" | "separado";
  pc: AnalyzedOffer;
  monitor: AnalyzedOffer | null; // null em kit (monitor incluso)
  total: number;
  totalIsComplete: boolean;
  score: number;
  verdict: Verdict;
  matchNotes: string[];
}

export interface UserLocation {
  cep: string;
  uf: string;
  city: string;
  source: string;
}
