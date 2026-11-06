/**
 * Tabela de referência de placas de vídeo.
 *
 * `index`: desempenho relativo em jogos (rasterização, 1080p/1440p), RTX 4060 = 100.
 * `watts`: consumo típico da placa (TGP/TBP) usado para checar a fonte.
 *
 * Os valores são aproximações agregadas de reviews públicos (médias de
 * vários jogos). Servem para comparar ofertas entre si, não como FPS exato.
 * Atualize esta tabela quando novas GPUs forem lançadas.
 */
export interface GpuRef {
  name: string;
  index: number;
  watts: number;
  vram?: number;
  integrated?: boolean;
}

export const GPUS: GpuRef[] = [
  // NVIDIA RTX 50
  { name: "RTX 5090", index: 340, watts: 575, vram: 32 },
  { name: "RTX 5080", index: 245, watts: 360, vram: 16 },
  { name: "RTX 5070 Ti", index: 220, watts: 300, vram: 16 },
  { name: "RTX 5070", index: 180, watts: 250, vram: 12 },
  { name: "RTX 5060 Ti", index: 140, watts: 180, vram: 16 },
  { name: "RTX 5060", index: 122, watts: 145, vram: 8 },
  { name: "RTX 5050", index: 95, watts: 130, vram: 8 },
  // RTX 40
  { name: "RTX 4090", index: 290, watts: 450, vram: 24 },
  { name: "RTX 4080 Super", index: 225, watts: 320, vram: 16 },
  { name: "RTX 4080", index: 220, watts: 320, vram: 16 },
  { name: "RTX 4070 Ti Super", index: 195, watts: 285, vram: 16 },
  { name: "RTX 4070 Ti", index: 182, watts: 285, vram: 12 },
  { name: "RTX 4070 Super", index: 170, watts: 220, vram: 12 },
  { name: "RTX 4070", index: 150, watts: 200, vram: 12 },
  { name: "RTX 4060 Ti", index: 120, watts: 160, vram: 8 },
  { name: "RTX 4060", index: 100, watts: 115, vram: 8 },
  // RTX 30
  { name: "RTX 3090 Ti", index: 182, watts: 450, vram: 24 },
  { name: "RTX 3090", index: 170, watts: 350, vram: 24 },
  { name: "RTX 3080 Ti", index: 165, watts: 350, vram: 12 },
  { name: "RTX 3080", index: 150, watts: 320, vram: 10 },
  { name: "RTX 3070 Ti", index: 128, watts: 290, vram: 8 },
  { name: "RTX 3070", index: 122, watts: 220, vram: 8 },
  { name: "RTX 3060 Ti", index: 108, watts: 200, vram: 8 },
  { name: "RTX 3060", index: 87, watts: 170, vram: 12 },
  { name: "RTX 3050", index: 62, watts: 130, vram: 8 },
  // RTX 20 / GTX 16
  { name: "RTX 2080 Ti", index: 120, watts: 250, vram: 11 },
  { name: "RTX 2080 Super", index: 103, watts: 250, vram: 8 },
  { name: "RTX 2080", index: 98, watts: 225, vram: 8 },
  { name: "RTX 2070 Super", index: 93, watts: 215, vram: 8 },
  { name: "RTX 2070", index: 84, watts: 175, vram: 8 },
  { name: "RTX 2060 Super", index: 80, watts: 175, vram: 8 },
  { name: "RTX 2060", index: 70, watts: 160, vram: 6 },
  { name: "GTX 1660 Ti", index: 56, watts: 120, vram: 6 },
  { name: "GTX 1660 Super", index: 55, watts: 125, vram: 6 },
  { name: "GTX 1660", index: 50, watts: 120, vram: 6 },
  { name: "GTX 1650 Super", index: 42, watts: 100, vram: 4 },
  { name: "GTX 1650", index: 32, watts: 75, vram: 4 },
  { name: "GTX 1630", index: 20, watts: 75, vram: 4 },
  // GTX 10 e anteriores
  { name: "GTX 1080 Ti", index: 90, watts: 250, vram: 11 },
  { name: "GTX 1080", index: 72, watts: 180, vram: 8 },
  { name: "GTX 1070 Ti", index: 66, watts: 180, vram: 8 },
  { name: "GTX 1070", index: 58, watts: 150, vram: 8 },
  { name: "GTX 1060", index: 45, watts: 120, vram: 6 },
  { name: "GTX 1050 Ti", index: 25, watts: 75, vram: 4 },
  { name: "GTX 1050", index: 20, watts: 75, vram: 2 },
  { name: "GTX 980 Ti", index: 50, watts: 250, vram: 6 },
  { name: "GTX 980", index: 42, watts: 165, vram: 4 },
  { name: "GTX 970", index: 36, watts: 145, vram: 4 },
  { name: "GTX 960", index: 26, watts: 120, vram: 2 },
  { name: "GTX 950", index: 21, watts: 90, vram: 2 },
  { name: "GTX 780 Ti", index: 30, watts: 250, vram: 3 },
  { name: "GTX 780", index: 26, watts: 250, vram: 3 },
  { name: "GTX 760", index: 18, watts: 170, vram: 2 },
  { name: "GTX 750 Ti", index: 14, watts: 60, vram: 2 },
  { name: "GTX 750", index: 12, watts: 55, vram: 1 },
  { name: "GTX 660", index: 13, watts: 140, vram: 2 },
  { name: "GTX 650", index: 7, watts: 65, vram: 1 },
  { name: "GT 1030", index: 10, watts: 30, vram: 2 },
  { name: "GT 740", index: 6, watts: 65, vram: 2 },
  { name: "GT 730", index: 4, watts: 40, vram: 2 },
  { name: "GT 720", index: 3, watts: 20, vram: 1 },
  { name: "GT 710", index: 2.5, watts: 20, vram: 2 },
  { name: "GT 630", index: 2.5, watts: 50, vram: 1 },
  { name: "GT 610", index: 1.5, watts: 30, vram: 1 },
  { name: "GT 210", index: 1, watts: 30, vram: 1 },
  // AMD RX 9000 / 7000
  { name: "RX 9070 XT", index: 230, watts: 304, vram: 16 },
  { name: "RX 9070 GRE", index: 185, watts: 220, vram: 12 },
  { name: "RX 9070", index: 210, watts: 220, vram: 16 },
  { name: "RX 9060 XT", index: 135, watts: 160, vram: 16 },
  { name: "RX 9060", index: 118, watts: 140, vram: 8 },
  { name: "RX 7900 XTX", index: 245, watts: 355, vram: 24 },
  { name: "RX 7900 XT", index: 215, watts: 315, vram: 20 },
  { name: "RX 7900 GRE", index: 185, watts: 260, vram: 16 },
  { name: "RX 7800 XT", index: 170, watts: 263, vram: 16 },
  { name: "RX 7700 XT", index: 145, watts: 245, vram: 12 },
  { name: "RX 7600 XT", index: 108, watts: 190, vram: 16 },
  { name: "RX 7600", index: 103, watts: 165, vram: 8 },
  // RX 6000
  { name: "RX 6950 XT", index: 190, watts: 335, vram: 16 },
  { name: "RX 6900 XT", index: 182, watts: 300, vram: 16 },
  { name: "RX 6800 XT", index: 170, watts: 300, vram: 16 },
  { name: "RX 6800", index: 150, watts: 250, vram: 16 },
  { name: "RX 6750 XT", index: 126, watts: 250, vram: 12 },
  { name: "RX 6700 XT", index: 120, watts: 230, vram: 12 },
  { name: "RX 6700", index: 110, watts: 175, vram: 10 },
  { name: "RX 6650 XT", index: 103, watts: 180, vram: 8 },
  { name: "RX 6600 XT", index: 98, watts: 160, vram: 8 },
  { name: "RX 6600", index: 88, watts: 132, vram: 8 },
  { name: "RX 6500 XT", index: 38, watts: 107, vram: 4 },
  { name: "RX 6400", index: 33, watts: 53, vram: 4 },
  // RX 5000 / Polaris
  { name: "RX 5700 XT", index: 88, watts: 225, vram: 8 },
  { name: "RX 5700", index: 80, watts: 180, vram: 8 },
  { name: "RX 5600 XT", index: 72, watts: 150, vram: 6 },
  { name: "RX 5500 XT", index: 48, watts: 130, vram: 8 },
  { name: "RX 590", index: 50, watts: 225, vram: 8 },
  { name: "RX 580", index: 46, watts: 185, vram: 8 },
  { name: "RX 570", index: 41, watts: 150, vram: 4 },
  { name: "RX 560", index: 22, watts: 80, vram: 4 },
  { name: "RX 550", index: 14, watts: 50, vram: 4 },
  { name: "R7 240", index: 4, watts: 30, vram: 2 },
  { name: "R5 230", index: 1.5, watts: 20, vram: 1 },
  // Intel Arc
  { name: "Arc B580", index: 118, watts: 190, vram: 12 },
  { name: "Arc B570", index: 105, watts: 150, vram: 10 },
  { name: "Arc A770", index: 105, watts: 225, vram: 16 },
  { name: "Arc A750", index: 95, watts: 225, vram: 8 },
  { name: "Arc A580", index: 85, watts: 185, vram: 8 },
  { name: "Arc A380", index: 35, watts: 75, vram: 6 },
  // Integradas
  { name: "Radeon 890M", index: 42, watts: 0, integrated: true },
  { name: "Radeon 780M", index: 35, watts: 0, integrated: true },
  { name: "Radeon 760M", index: 28, watts: 0, integrated: true },
  { name: "Radeon 740M", index: 18, watts: 0, integrated: true },
  { name: "Radeon 680M", index: 30, watts: 0, integrated: true },
  { name: "Radeon Vega 11", index: 14, watts: 0, integrated: true },
  { name: "Radeon Vega 8", index: 17, watts: 0, integrated: true },
  { name: "Radeon Vega 7", index: 18, watts: 0, integrated: true },
  { name: "Radeon Vega 6", index: 13, watts: 0, integrated: true },
  { name: "Radeon Vega 3", index: 7, watts: 0, integrated: true },
  { name: "Iris Xe", index: 14, watts: 0, integrated: true },
  { name: "UHD 770", index: 8, watts: 0, integrated: true },
  { name: "UHD 730", index: 7, watts: 0, integrated: true },
  { name: "UHD 630", index: 6, watts: 0, integrated: true },
  { name: "HD 620", index: 4, watts: 0, integrated: true },
];

/** GPU integrada típica de cada CPU com vídeo integrado (quando o anúncio não informa GPU dedicada). */
export const IGPU_BY_CPU: Array<[RegExp, string]> = [
  [/\b8700g\b/, "Radeon 780M"],
  [/\b8600g\b/, "Radeon 760M"],
  [/\b8500g\b/, "Radeon 740M"],
  [/\b(5700g|5600g|5600gt|5500gt|4600g|4650g)\b/, "Radeon Vega 7"],
  [/\b(5300g|4350g|4300g)\b/, "Radeon Vega 6"],
  [/\b(3400g|2400g)\b/, "Radeon Vega 11"],
  [/\b(3200g|2200g)\b/, "Radeon Vega 8"],
  [/\b(3000g|200ge|220ge|240ge)\b/, "Radeon Vega 3"],
  [/\bi[3579]-?1[234]\d{3}(?!f)[a-z]*\b/, "UHD 770"],
  [/\bi[3579]-?1[01]\d{3}(?!f)[a-z]*\b/, "UHD 630"],
];

export interface MatchedGpu {
  ref: GpuRef;
}

function tokensToRegex(name: string): RegExp {
  const parts = name.toLowerCase().split(/\s+/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // Permite "rtx4060", "rtx-4060", "rtx 4060", "4060ti"
  const body = parts.join("[\\s-]*");
  // "rtx 4060" não pode casar com "rtx 4060 ti"/"super"/"xt": exige que não venha um sufixo depois.
  return new RegExp(`(^|[^a-z0-9])${body}(?![a-z0-9])(?![\\s-]*(ti|super|xt|xtx|gre)\\b)`, "i");
}

const GPU_PATTERNS = [...GPUS]
  .sort((a, b) => b.name.length - a.name.length)
  .map((ref) => ({ ref, re: tokensToRegex(ref.name) }));

/** Encontra a GPU citada no texto (somente modelos conhecidos). */
export function matchGpu(text: string): GpuRef | null {
  const t = normalizeGpuText(text);
  for (const { ref, re } of GPU_PATTERNS) {
    if (re.test(t)) return ref;
  }
  return null;
}

export function findGpuByName(name: string): GpuRef | null {
  return GPUS.find((g) => g.name.toLowerCase() === name.toLowerCase()) ?? null;
}

function normalizeGpuText(text: string): string {
  return text
    .toLowerCase()
    .replace(/geforce|nvidia|radeon(?!\s*(vega|\d{3}m))|amd/g, " ")
    .replace(/g\s*force/g, " ")
    // "RTX4060TI" → "rtx 4060 ti"
    .replace(/(rtx|gtx|gt|rx|arc)\s*-?\s*([ab]?\d{3,4})(?:\s*(ti|super|xtx|xt|gre)\b)?/g, (_m, p, n, s) => `${p} ${n}${s ? " " + s : ""}`)
    .replace(/\s+/g, " ");
}
