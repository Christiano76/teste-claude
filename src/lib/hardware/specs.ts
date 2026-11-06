/**
 * Extração de especificações a partir do título e da ficha técnica do anúncio.
 * Nada é inventado: o que não for encontrado fica `null` e entra em `missing`.
 */
import type { Category, GpuInfo, MonitorSpecs, ParsedSpecs, PcSpecs, PsuInfo, StorageInfo } from "../types";
import { parseCpu } from "./cpus";
import { IGPU_BY_CPU, findGpuByName, matchGpu } from "./gpus";

export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const MONITOR_WORDS = /\bmonitor\b/i;
const PC_WORDS = /\b(pc|computador|desktop|cpu gamer|workstation|mini ?pc)\b/i;

const ACCESSORY = /^(suporte|filtro|cabo|bra[cç]o|gabinete|fonte|placa[\s-]m[aã]e|placa de v[ií]deo|mem[oó]ria|ssd|hd\b|teclado|mouse|headset|cooler|water|kit (upgrade|placa)|pel[ií]cula|capa|adaptador|webcam|controle|cadeira|mesa|estabilizador|nobreak|processador|limpa|hub|dock|switch|roteador|caixa de som)/i;

/** Acessórios e peças avulsas que aparecem em buscas por "pc gamer"/"monitor". */
export function isAccessory(title: string): boolean {
  const t = title.trim().toLowerCase();
  if (ACCESSORY.test(t)) return true;
  if (/\b(para|p\/)\s*monitor\b/.test(t) && !/\bmonitor\s+(gamer|led|ips)/.test(t.split(/para|p\//)[0])) return true;
  return false;
}

export function detectCategory(title: string, hint: Category | null): Category {
  if (hint) return hint;
  const t = title.toLowerCase();
  if (MONITOR_WORDS.test(t) && !PC_WORDS.test(t.split("monitor")[0])) return "monitor";
  return "pc";
}

// ---------- Monitor ----------

export function parseMonitor(text: string): MonitorSpecs {
  const t = text.toLowerCase().replace(/,(\d)/g, ".$1");

  const sizeM = t.match(/(\d{2}(?:\.\d)?)\s*(?:"|''|”|pol\b|polegadas|pulgadas|inch|in\b)/);
  // Fallback: "Monitor Gamer LED 27 Dx270" (número logo após "monitor", sem unidade)
  const sizeLoose = sizeM ? null : t.match(/monitor[^0-9\n]{0,30}?\b(1[5-9]|[2-4]\d)(?:\.\d)?\b(?!\s*(?:hz|ms|gb|w\b|x\b|mm|cm))/);
  const sizeIn = sizeM ? Number(sizeM[1]) : sizeLoose ? Number(sizeLoose[0].match(/(\d{2}(?:\.\d)?)\s*$/)?.[1] ?? sizeLoose[1]) : null;

  let width: number | null = null;
  let height: number | null = null;
  const resM = t.match(/\b(\d{4})\s*[x×]\s*(\d{3,4})\b/);
  if (resM) {
    width = Number(resM[1]);
    height = Number(resM[2]);
  } else if (/\b(4k|uhd|2160p|3840)\b/.test(t)) {
    [width, height] = [3840, 2160];
  } else if (/\b(wqhd|uwqhd|ultrawide qhd)\b/.test(t) && /(ultrawide|21:9|34"|34 pol)/.test(t)) {
    [width, height] = [3440, 1440];
  } else if (/\b(qhd|2k|1440p|wqhd|2560)\b/.test(t)) {
    [width, height] = [2560, 1440];
  } else if (/\b(wfhd|uwfhd|2560\s*x\s*1080)\b/.test(t)) {
    [width, height] = [2560, 1080];
  } else if (/\b(full\s*hd|fhd|1080p|1920)\b/.test(t)) {
    [width, height] = [1920, 1080];
  } else if (/(\bwxga\+|\bhd\+|\b1600\s*x\s*900\b)/.test(t)) {
    [width, height] = [1600, 900];
  } else if (/\b(wxga|hd|1366|720p)\b/.test(t)) {
    [width, height] = [1366, 768];
  }

  const hzM = t.match(/(\d{2,3})\s*hz\b/g);
  const refreshHz = hzM ? Math.max(...hzM.map((x) => Number(x.replace(/\D/g, "")))) : null;

  let panel: MonitorSpecs["panel"] = null;
  if (/qd-?oled/.test(t)) panel = "QD-OLED";
  else if (/\boled\b/.test(t)) panel = "OLED";
  else if (/mini[\s-]?led/.test(t)) panel = "Mini-LED";
  else if (/\b(ips|fast ips|nano ips|ahva|ads|pls)\b/.test(t)) panel = "IPS";
  else if (/\b(va|hva|mva)\b/.test(t)) panel = "VA";
  else if (/\btn\b/.test(t)) panel = "TN";

  const msM = t.match(/(\d(?:\.\d+)?)\s*ms\b/);
  const responseMs = msM ? Number(msM[1]) : null;

  const curved = /\bcurv[oa]|curved\b/.test(t) ? true : null;
  const hdrM = t.match(/(displayhdr\s*\d{3,4}|hdr\s*10\+?|hdr\s*\d{3,4}|\bhdr\b)/);
  const hdr = hdrM ? hdrM[1].toUpperCase().replace(/\s+/g, " ") : null;
  let adaptiveSync: string | null = null;
  if (/freesync premium pro/.test(t)) adaptiveSync = "FreeSync Premium Pro";
  else if (/freesync premium/.test(t)) adaptiveSync = "FreeSync Premium";
  else if (/freesync/.test(t)) adaptiveSync = "FreeSync";
  if (/g-?sync(?! comp)/.test(t)) adaptiveSync = adaptiveSync ? `${adaptiveSync} / G-Sync` : "G-Sync";
  else if (/g-?sync comp/.test(t)) adaptiveSync = adaptiveSync ? `${adaptiveSync} / G-Sync Compatible` : "G-Sync Compatible";
  else if (!adaptiveSync && /\b(vrr|adaptive[\s-]?sync)\b/.test(t)) adaptiveSync = "Adaptive-Sync";

  const ports: string[] = [];
  if (/hdmi\s*2\.1/.test(t)) ports.push("HDMI 2.1");
  else if (/hdmi/.test(t)) ports.push("HDMI");
  if (/displayport|\bdp\b/.test(t)) ports.push("DisplayPort");
  if (/usb[\s-]?c|type[\s-]?c/.test(t)) ports.push("USB-C");
  if (/\bvga\b/.test(t)) ports.push("VGA");
  if (/\bdvi\b/.test(t)) ports.push("DVI");

  return { sizeIn, width, height, resolutionLabel: resolutionLabel(width, height), refreshHz, panel, responseMs, curved, hdr, adaptiveSync, ports };
}

export function resolutionLabel(w: number | null, h: number | null): string | null {
  if (!w || !h) return null;
  if (w >= 3840) return "4K";
  if (w >= 3440 && h >= 1440) return "Ultrawide 1440p";
  if (w >= 2560 && h >= 1440) return "1440p";
  if (w >= 2560 && h >= 1080) return "Ultrawide 1080p";
  if (h >= 1080) return "1080p";
  if (h >= 900) return "900p";
  return "720p";
}

// ---------- PC ----------

function parseRam(t: string): { gb: number | null; type: PcSpecs["ramType"] } {
  const type = /ddr5/.test(t) ? "DDR5" : /ddr4/.test(t) ? "DDR4" : /ddr3/.test(t) ? "DDR3" : null;
  // "16gb ddr4", "memória 16gb", "16gb ram", "2x8gb"
  const dual = t.match(/(\d)\s*x\s*(\d{1,2})\s*gb/);
  if (dual) return { gb: Number(dual[1]) * Number(dual[2]), type };
  const allowed = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128];
  const patterns = [
    /(\d{1,3})\s*gb\s*(?:de\s*)?(?:ram|mem[oó]ria|ddr\d)/g,
    /(?:ram|mem[oó]ria)\s*(?:ram\s*)?(?:de\s*)?(\d{1,3})\s*gb/g,
    /(\d{1,3})\s*gb(?!\s*(?:ssd|hd|hdd|nvme|m\.2|de\s*armazenamento|gddr|vram|de\s*v[ií]deo))/g,
  ];
  // GBs que pertencem à placa de vídeo ("RTX 4060 8GB") não contam como RAM
  const cleaned = t.replace(/\b(rtx|gtx|gt|rx|arc|vga|geforce|v[ií]deo)[^,|\n]{0,25}?\d{1,2}\s*gb/g, " ");
  for (const re of patterns) {
    for (const m of cleaned.matchAll(re)) {
      const gb = Number(m[1]);
      if (allowed.includes(gb)) return { gb, type };
    }
  }
  return { gb: null, type };
}

function parseStorage(t: string): StorageInfo[] {
  const out: StorageInfo[] = [];
  const kindOf = (k: string): StorageInfo["type"] => (/nvme|m\.2/.test(k) ? "nvme" : /ssd/.test(k) ? "ssd" : /hd/.test(k) ? "hdd" : "unknown");
  const add = (num: number, unit: string, kind: string) => {
    const gb = unit === "tb" ? num * 1000 : num;
    if (gb < 60 || gb > 16000) return;
    const type = kindOf(kind);
    if (!out.some((s) => s.gb === gb)) out.push({ type, gb });
  };
  // "SSD 480GB", "Nvme 2TB", "SSD M.2 Nvme 1TB"
  for (const m of t.matchAll(/(ssd(?:\s*m\.2)?(?:\s*nvme)?|nvme|m\.2|hdd|\bhd)\s*(?:de\s*)?(\d{1,4}(?:\.\d)?)\s*(tb|gb)\b/g)) add(Number(m[2]), m[3], m[1]);
  // "480GB SSD", "1TB Nvme"
  for (const m of t.matchAll(/(\d{1,4}(?:\.\d)?)\s*(tb|gb)\s*(?:de\s*)?(ssd|nvme|m\.2|hdd|hd)\b/g)) add(Number(m[1]), m[2], m[3]);
  return out;
}

function parsePsu(t: string): PsuInfo | null {
  const w = t.match(/(?:fonte|psu)[^\n]{0,40}?(\d{3,4})\s*w\b|(\d{3,4})\s*w\s*(?:reais\s*)?(?:80\s*plus|80\+|bronze|gold|real|pfc)/);
  const watts = w ? Number(w[1] ?? w[2]) : null;
  const r = t.match(/80\s*(?:plus|\+)\s*(white|bronze|silver|gold|platinum|titanium)?/);
  let rating: string | null = null;
  if (r) rating = `80 Plus${r[1] ? " " + r[1][0].toUpperCase() + r[1].slice(1) : ""}`;
  else if (/\b(bronze|gold|platinum)\b/.test(t) && /fonte/.test(t)) {
    const g = t.match(/\b(bronze|gold|platinum)\b/)![1];
    rating = `80 Plus ${g[0].toUpperCase()}${g.slice(1)}`;
  }
  if (watts == null && rating == null) return null;
  return { watts, rating, certified: rating ? true : null };
}

function parseMotherboard(t: string): PcSpecs["motherboard"] {
  const chip = t.match(/\b([abhxbqz]\d{3}[a-z]?)\b(?=[^\n]{0,30})/g);
  const known = chip?.map((c) => c.toUpperCase()).find((c) => /^(A320|A520|A620|B350|B450|B550|B650E?|B840|B850|X370|X470|X570|X670E?|X870E?|H81|H110|H310|H410|H510|H610|B360|B365|B460|B560|B660|B760|Z390|Z490|Z590|Z690|Z790|Z890|B860|H810|X79|X99|H61|B75|H55|B85|H97|Z97)$/.test(c)) ?? null;
  const socketM = t.match(/\b(am4|am5|lga\s*-?\s*(1700|1851|1200|1151|1150|1155|2011(?:-3)?))\b/);
  const socket = socketM ? socketM[1].toUpperCase().replace(/\s|-(?!3)/g, "") : null;
  if (!known && !socket) return null;
  return { chipset: known, socket };
}

export function parsePc(title: string, extraText: string | null): PcSpecs {
  const full = `${title}\n${extraText ?? ""}`;
  const t = full.toLowerCase().replace(/,(\d)/g, ".$1");
  const tTitle = title.toLowerCase();

  // CPU: prioriza o título (ficha pode citar compatibilidades)
  const cpu = parseCpu(title) ?? (extraText ? parseCpu(extraText) : null);
  // Se o título só tinha "i5 10ª" e a ficha tem o modelo exato, usa a ficha.
  let cpuFinal = cpu;
  if (cpu && cpu.model.includes("não informad") && extraText) {
    const fromSpecs = parseCpu(extraText);
    if (fromSpecs && !fromSpecs.model.includes("não informad")) cpuFinal = fromSpecs;
  }

  let gpu: GpuInfo | null = null;
  const gRef = matchGpu(title) ?? (extraText ? matchGpu(extraText) : null);
  if (gRef) {
    const vramM = t.match(/(\d{1,2})\s*gb\s*(?:gddr\d|vram|de\s*v[ií]deo)/);
    gpu = { model: gRef.name, vramGb: vramM ? Number(vramM[1]) : gRef.vram ?? null, integrated: !!gRef.integrated, index: gRef.index };
  } else if (/\b(v[ií]deo|gr[aá]ficos?)\s*integrad[oa]|radeon graphics|vega\b|uhd graphics|intel graphics/.test(t) || (cpuFinal?.integratedGpu && !/(rtx|gtx|\brx\s?\d|arc\s?[ab]\d|gt\s?\d{3})/.test(t))) {
    const cpuText = (cpuFinal?.model ?? "").toLowerCase().replace(/\s+/g, "");
    const ig = IGPU_BY_CPU.find(([re]) => re.test(cpuText) || re.test(tTitle));
    const ref = ig ? findGpuByName(ig[1]) : null;
    gpu = ref
      ? { model: `${ref.name} (integrada)`, vramGb: null, integrated: true, index: ref.index }
      : { model: "Vídeo integrado (presumido: nenhuma placa de vídeo citada)", vramGb: null, integrated: true, index: 6 };
  } else {
    const unknownM = t.match(/\b(rtx|gtx|gt|rx|arc)\s*-?\s*([ab]?\d{3,4})\s*(ti|super|xt|xtx)?/);
    if (unknownM) gpu = { model: unknownM[0].toUpperCase(), vramGb: null, integrated: false, index: null };
    else if (/placa de v[ií]deo|geforce|radeon rx|\bvga\b|\brtx\b|\bgtx\b/.test(t)) gpu = { model: "Dedicada (modelo não informado)", vramGb: null, integrated: false, index: null };
  }

  const ram = parseRam(t);
  const storage = parseStorage(t);
  const psu = parsePsu(t);
  const motherboard = parseMotherboard(t);
  const osM = full.match(/windows\s*(1[01])\s*(pro|home)?|linux|ubuntu/i);

  const includesMonitor = /(\+|com|e|kit)\s*monitor|monitor\s*(led|ips|gamer)?\s*\d{2}(?:[.,]\d)?\s*("|pol|”)|pc\s*completo/.test(tTitle) || /\bmonitor\b/.test(tTitle) && /(pc|computador)/.test(tTitle);
  let monitor: MonitorSpecs | null = null;
  if (includesMonitor) {
    const idx = t.indexOf("monitor");
    monitor = parseMonitor(idx >= 0 ? t.slice(idx, idx + 600) : t);
  }
  const includesPeripherals = /(teclado|mouse|headset|fone|kit gamer)/.test(tTitle);

  return {
    cpu: cpuFinal,
    gpu,
    ramGb: ram.gb,
    ramType: ram.type,
    storage,
    psu,
    motherboard,
    os: osM ? osM[0].replace(/\s+/g, " ") : null,
    includesMonitor,
    monitor,
    includesPeripherals,
  };
}

export function parseSpecs(title: string, extraText: string | null, hint: Category | null): ParsedSpecs {
  const category = detectCategory(title, hint);
  if (category === "monitor") {
    const monitor = parseMonitor(`${title}\n${extraText ?? ""}`);
    const missing: string[] = [];
    if (!monitor.sizeIn) missing.push("tamanho");
    if (!monitor.resolutionLabel) missing.push("resolução");
    if (!monitor.refreshHz) missing.push("frequência");
    if (!monitor.panel) missing.push("painel");
    if (monitor.responseMs == null) missing.push("tempo de resposta");
    return { category, pc: null, monitor, missing };
  }
  const pc = parsePc(title, extraText);
  const missing: string[] = [];
  if (!pc.cpu) missing.push("processador");
  else if (pc.cpu.index == null) missing.push("modelo exato do processador");
  if (!pc.gpu) missing.push("placa de vídeo");
  else if (pc.gpu.index == null) missing.push("modelo exato da placa de vídeo");
  if (!pc.ramGb) missing.push("memória RAM");
  if (pc.storage.length === 0) missing.push("armazenamento");
  if (!pc.psu?.watts) missing.push("potência da fonte");
  if (!pc.psu?.rating) missing.push("certificação da fonte");
  if (!pc.motherboard) missing.push("placa-mãe");
  return { category, pc, monitor: pc.monitor, missing };
}

/** Chave canônica para detectar o mesmo produto em várias lojas / anúncios duplicados. */
export function canonicalKey(category: Category, specs: ParsedSpecs, title: string, brand: string | null): string {
  if (category === "monitor" && specs.monitor) {
    const m = specs.monitor;
    // modelo do fabricante costuma vir como token alfanumérico longo (ex.: "VG27AQ3A", "Mgled27brx")
    const model = title.match(/\b(?=[a-z0-9-]*\d)(?=[a-z0-9-]*[a-z])[a-z0-9-]{6,}\b/gi)?.filter((x) => !/^\d+(hz|ms|gb)$/i.test(x) && !/^\d{4}x\d{3,4}$/i.test(x)).pop();
    if (model && brand) return `mon:${brand.toLowerCase()}:${model.toLowerCase()}`;
    return `mon:${(brand ?? "?").toLowerCase()}:${m.sizeIn}:${m.resolutionLabel}:${m.refreshHz}:${m.panel}`;
  }
  const p = specs.pc;
  const sto = p?.storage.map((s) => `${s.type}${s.gb}`).join("+") ?? "";
  return `pc:${p?.cpu?.model ?? "?"}:${p?.gpu?.model ?? "?"}:${p?.ramGb ?? "?"}:${sto}:${p?.includesMonitor ? "mon" : ""}`.toLowerCase();
}
