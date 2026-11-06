/**
 * Referência de processadores para jogos.
 * `index`: desempenho relativo em jogos, Ryzen 5 5600 = 100 (aproximação de reviews públicos).
 * Quando o anúncio só informa família + geração ("i5 10ª"), usamos uma estimativa
 * por geração e sinalizamos que o modelo exato não foi informado.
 */
import type { CpuInfo } from "../types";

const AMD: Record<string, number> = {
  // AMD AM5
  "9950x3d": 180, "9900x3d": 172, "9800x3d": 185, "9950x": 150, "9900x": 148, "9700x": 145,
  "9600x": 140, "9600": 138, "7950x3d": 170, "7900x3d": 160, "7800x3d": 165, "7950x": 140,
  "7900x": 137, "7900": 134, "7700x": 135, "7700": 133, "7600x": 131, "7600": 128,
  "7500f": 125, "8700g": 120, "8600g": 118, "8500g": 105, "8400f": 112, "8700f": 118,
  // AMD AM4
  "5800x3d": 130, "5700x3d": 125, "5600x3d": 125, "5950x": 113, "5900x": 112, "5800x": 110,
  "5800": 108, "5700x": 107, "5700": 98, "5600x": 104, "5600": 100, "5600t": 100, "5600xt": 104,
  "5500": 92, "5500x3d": 118, "5700g": 95, "5600g": 90, "5600gt": 92, "5500gt": 88, "5300g": 80,
  "4600g": 82, "4650g": 82, "4500": 84, "4100": 72, "3600": 82, "3600x": 84, "3700x": 86,
  "3800x": 87, "3900x": 89, "3100": 70, "3300x": 78, "3400g": 60, "3200g": 55, "2600": 68,
  "2600x": 70, "2700x": 74, "1600": 58, "1700": 60, "2400g": 50, "2200g": 46, "3000g": 32,
};

const INTEL: Record<string, number> = {
  // Intel Core Ultra 200S
  "285k": 155, "265k": 150, "265kf": 150, "265f": 145, "265": 145, "245k": 140, "245kf": 140,
  "245": 132, "225": 115, "225f": 115,
  // Intel 12-14
  "14900k": 162, "14900kf": 162, "14900f": 150, "14700k": 155, "14700kf": 155, "14700f": 145,
  "14700": 145, "14600k": 143, "14600kf": 143, "14500": 128, "14400f": 118, "14400": 118,
  "14100f": 98, "14100": 98, "13900k": 158, "13900kf": 158, "13700k": 150, "13700kf": 150,
  "13700f": 140, "13600k": 140, "13600kf": 140, "13500": 125, "13400f": 115, "13400": 115,
  "13100f": 96, "13100": 96, "12900k": 140, "12900kf": 140, "12700k": 135, "12700kf": 135,
  "12700f": 128, "12700": 128, "12600k": 125, "12600kf": 125, "12500": 108, "12400f": 107,
  "12400": 107, "12100f": 92, "12100": 92,
  // Intel 10-11
  "11900k": 102, "11700k": 98, "11700f": 95, "11600k": 95, "11400f": 90, "11400": 90,
  "10900k": 100, "10700k": 95, "10700f": 92, "10700": 92, "10600k": 88, "10400f": 80,
  "10400": 80, "10105f": 72, "10100f": 72, "10100": 72,
  // Intel 6-9
  "9900k": 92, "9700k": 88, "9700f": 85, "9700": 85, "9600k": 78, "9400f": 72, "9400": 72,
  "9100f": 60, "8700k": 85, "8700": 82, "8600k": 74, "8400": 70, "8100": 56, "7700k": 70,
  "7700": 65, "7600": 58, "7500": 55, "7400": 52, "7100": 45, "6700k": 65, "6700": 62,
  "6600": 52, "6500": 50, "6100": 42,
  // Intel 2-4
  "4790k": 58, "4790": 55, "4770": 53, "4690": 46, "4590": 45, "4570": 44, "4460": 42,
  "4440": 41, "4160": 33, "4150": 33, "4130": 32, "3770": 42, "3570": 39, "3470": 38,
  "3450": 37, "3330": 35, "3240": 26, "3220": 25, "2600": 36, "2500": 32, "2400": 31, "2120": 22,
  "2100": 21,
};

/** Estimativa por família + geração Intel: [i3, i5, i7, i9] */
const INTEL_GEN: Record<number, [number, number, number, number]> = {
  2: [21, 31, 36, 36], 3: [25, 37, 42, 42], 4: [32, 44, 54, 54], 5: [34, 46, 56, 56],
  6: [42, 51, 63, 63], 7: [45, 55, 66, 66], 8: [56, 70, 82, 82], 9: [60, 72, 86, 92],
  10: [72, 80, 92, 100], 11: [74, 90, 97, 102], 12: [92, 107, 130, 140], 13: [96, 115, 145, 158],
  14: [98, 118, 150, 162],
};

/** Estimativa por série Ryzen (milhar): [R3, R5, R7, R9] */
const RYZEN_SERIES: Record<number, [number, number, number, number]> = {
  1: [42, 56, 60, 60], 2: [48, 68, 72, 72], 3: [68, 82, 86, 89], 4: [72, 83, 88, 88],
  5: [85, 98, 107, 112], 7: [105, 128, 134, 138], 8: [100, 115, 120, 120], 9: [110, 138, 145, 150],
};

function intelSocket(gen: number): string | null {
  if (gen >= 12 && gen <= 14) return "LGA1700";
  if (gen >= 10) return "LGA1200";
  if (gen >= 6) return "LGA1151";
  if (gen >= 4) return "LGA1150";
  if (gen >= 2) return "LGA1155";
  return null;
}

function intelAge(gen: number): CpuInfo["generationAge"] {
  if (gen >= 13) return "current";
  if (gen >= 12) return "recent";
  if (gen >= 8) return "old";
  return "obsolete";
}

function ryzenAge(series: number): CpuInfo["generationAge"] {
  if (series >= 7) return "current";
  if (series === 5) return "recent";
  if (series >= 3) return "old";
  return "obsolete";
}

const ORDINAL = "(?:\\s*(?:ª|º|°)|\\s*(?:a|o)?\\s*gera[cç][aã]o|\\s*gen\\b)";

/** Extrai o processador do texto do anúncio. Retorna null se não houver menção. */
export function parseCpu(text: string): CpuInfo | null {
  const t = text.toLowerCase().replace(/®|™/g, "");

  // Core Ultra (série 200)
  let m = t.match(/(?:core\s*)?ultra\s*([579])\s*-?\s*(2\d{2})([a-z]{0,2})\b/);
  if (m) {
    const key = `${m[2]}${m[3]}`;
    const index = INTEL[key] ?? INTEL[m[2]] ?? null;
    return { model: `Core Ultra ${m[1]} ${m[2]}${m[3].toUpperCase()}`, vendor: "intel", index, integratedGpu: m[3].includes("f") ? null : "Intel Graphics", generationAge: "current", socket: "LGA1851" };
  }

  // Intel Core iX-NNNNN(sufixo)
  m = t.match(/\bi\s*([3579])\s*[-\s]?\s*(1[0-4]\d{3}|[2-9]\d{3})([a-z]{0,2})\b/);
  if (m) {
    const num = m[2];
    const suffix = m[3] ?? "";
    const gen = num.length === 5 ? Number(num.slice(0, 2)) : Number(num[0]);
    const fam = Number(m[1]);
    const key = `${num}${suffix}`;
    let index = INTEL[key] ?? INTEL[num] ?? null;
    if (index == null && INTEL_GEN[gen]) index = INTEL_GEN[gen][[3, 5, 7, 9].indexOf(fam)];
    return {
      model: `Core i${fam}-${num}${suffix.toUpperCase()}`,
      vendor: "intel",
      index,
      integratedGpu: suffix.includes("f") ? null : "Intel UHD",
      generationAge: intelAge(gen),
      socket: intelSocket(gen),
    };
  }

  // Intel "i5 10ª geração" / "I7 4º" / "Core i5 10°"
  m = t.match(new RegExp(`\\bi\\s*([3579])\\s*(?:-\\s*)?(1[0-4]|[2-9])${ORDINAL}(?![0-9])`));
  if (m) {
    const fam = Number(m[1]);
    const gen = Number(m[2]);
    const idx = INTEL_GEN[gen]?.[[3, 5, 7, 9].indexOf(fam)] ?? null;
    return { model: `Core i${fam} ${gen}ª geração (modelo exato não informado)`, vendor: "intel", index: idx, integratedGpu: null, generationAge: intelAge(gen), socket: intelSocket(gen) };
  }

  // AMD Ryzen
  m = t.match(/ryzen\s*([3579])\s*(?:pro\s*)?-?\s*(\d{4})([a-z0-9]{0,4})\b/);
  if (m) {
    const num = m[2];
    const suf = m[3] ?? "";
    const key = `${num}${suf}`;
    const series = Number(num[0]);
    const fam = Number(m[1]);
    let index = AMD[key] ?? AMD[num] ?? null;
    if (index == null && RYZEN_SERIES[series]) index = RYZEN_SERIES[series][[3, 5, 7, 9].indexOf(fam)];
    const isDesktopAm5 = series >= 7 || key.startsWith("8");
    const hasIgpu = /g/.test(suf) || series >= 7 && !/f/.test(suf);
    return {
      model: `Ryzen ${fam} ${num}${suf.toUpperCase()}`,
      vendor: "amd",
      index,
      integratedGpu: hasIgpu ? "Radeon" : null,
      generationAge: ryzenAge(series),
      socket: isDesktopAm5 ? "AM5" : "AM4",
    };
  }

  // "Ryzen 4700S" (sem família)
  m = t.match(/ryzen\s*(\d{4})([a-z]{0,2})\b/);
  if (m) {
    const num = m[1];
    const index = AMD[`${num}${m[2]}`] ?? AMD[num] ?? (num === "4700" ? 70 : null);
    return { model: `Ryzen ${num}${m[2].toUpperCase()}`, vendor: "amd", index, integratedGpu: null, generationAge: ryzenAge(Number(num[0])), socket: null };
  }

  // Ryzen sem modelo (ex.: "Ryzen 5")
  m = t.match(/ryzen\s*([3579])\b/);
  if (m) {
    return { model: `Ryzen ${m[1]} (modelo exato não informado)`, vendor: "amd", index: null, integratedGpu: null, generationAge: null, socket: null };
  }

  // Xeon (comum em kits X99 importados)
  m = t.match(/xeon\s*(e5|e3)?\s*-?\s*(\d{4})?\s*(v\d)?/);
  if (m && t.includes("xeon")) {
    return { model: `Xeon ${[m[1], m[2], m[3]].filter(Boolean).join(" ").toUpperCase()}`.trim(), vendor: "intel", index: 50, integratedGpu: null, generationAge: "obsolete", socket: m[1] === "e5" ? "LGA2011-3" : null };
  }

  // Celeron/Pentium/Athlon/N100 — muito fracos para jogos
  m = t.match(/\b(celeron|pentium|athlon|intel\s*n\d{2,3}|n100|n200|a[468]-\d{4})\b/);
  if (m) {
    return { model: m[1].replace(/\b\w/g, (c) => c.toUpperCase()), vendor: /^(athlon|a\d)/.test(m[1]) ? "amd" : "intel", index: 25, integratedGpu: "integrada", generationAge: "obsolete", socket: null };
  }

  // "Intel I7" sem geração
  m = t.match(/\b(?:core\s*)?i\s*([3579])\b/);
  if (m) {
    return { model: `Core i${m[1]} (geração não informada)`, vendor: "intel", index: null, integratedGpu: null, generationAge: null, socket: null };
  }

  return null;
}
