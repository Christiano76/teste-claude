/**
 * Reconhecimento de peças avulsas (placa de vídeo, processador, memória, SSD, placa-mãe, fonte).
 * Uma peça NUNCA é tratada como computador completo.
 */
import type { PartSpecs } from "../types";
import { parseCpu } from "./cpus";
import { matchGpu } from "./gpus";

const PC_WORDS = /\b(pc|computador|desktop|cpu\s+(gamer|completa|completo|intel|amd|i[3579]|ryzen)|workstation|all[\s-]?in[\s-]?one)\b/i;

export function classifyPart(title: string): PartSpecs | null {
  const t = title.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (PC_WORDS.test(t) || /^kit\b/.test(t)) return null;

  if (/^(placa\s+de\s+video|placa\s+video|gpu\b|vga\b)/.test(t) || (/^(geforce|radeon|nvidia|amd|asus|msi|gigabyte|galax|pny|zotac|xfx|sapphire|powercolor|palit|inno3d|pcyes|afox|zogis)\b/.test(t) && /\b(rtx|gtx|gt|rx|arc)\s?-?[ab]?\d{3,4}/.test(t))) {
    const g = matchGpu(title);
    const vram = t.match(/(\d{1,2})\s*gb/);
    return { kind: "gpu", model: g?.name ?? null, index: g?.index ?? null, capacity: vram ? Number(vram[1]) : null, detail: g ? null : "modelo não reconhecido" };
  }
  if (/^processador\b/.test(t)) {
    const c = parseCpu(title);
    return { kind: "cpu", model: c?.model ?? null, index: c?.index ?? null, capacity: null, detail: c?.socket ?? null };
  }
  if (/^(memoria|modulo de memoria)\b/.test(t)) {
    const kit = t.match(/(\d)\s*x\s*(\d{1,2})\s*gb/);
    const gb = kit ? Number(kit[1]) * Number(kit[2]) : Number(t.match(/(\d{1,3})\s*gb/)?.[1] ?? NaN);
    const type = t.match(/ddr[345]/)?.[0].toUpperCase() ?? null;
    return { kind: "ram", model: type ? `${gb || "?"} GB ${type}` : null, index: null, capacity: Number.isFinite(gb) ? gb : null, detail: type };
  }
  if (/^(ssd|hd\s+ssd|nvme)\b/.test(t)) {
    const tb = t.match(/(\d(?:[.,]\d)?)\s*tb/);
    const gb = tb ? Number(tb[1].replace(",", ".")) * 1000 : Number(t.match(/(\d{3,4})\s*gb/)?.[1] ?? NaN);
    const iface = /nvme|m\.2|pcie/.test(t) ? "NVMe" : "SATA";
    return { kind: "ssd", model: Number.isFinite(gb) ? `SSD ${gb >= 1000 ? gb / 1000 + " TB" : gb + " GB"} ${iface}` : null, index: null, capacity: Number.isFinite(gb) ? gb : null, detail: iface };
  }
  if (/^placa[\s-]?mae\b/.test(t)) {
    const chip = t.match(/\b([abhxz]\d{2,3}m?)\b/)?.[1]?.toUpperCase() ?? null;
    const sock = t.match(/\b(am4|am5|lga\s?-?\d{4})\b/)?.[1]?.toUpperCase().replace(/\s|-/g, "") ?? null;
    return { kind: "placa-mae", model: chip, index: null, capacity: null, detail: sock };
  }
  if (/^fonte\b/.test(t) && !/notebook|monitor|externa|carregador/.test(t)) {
    const w = Number(t.match(/(\d{3,4})\s*w\b/)?.[1] ?? NaN);
    const cert = t.match(/80\s*(plus|\+)\s*(bronze|silver|gold|platinum|titanium|white)?/)?.[0] ?? null;
    return { kind: "fonte", model: Number.isFinite(w) ? `${w} W${cert ? " " + cert : ""}` : null, index: null, capacity: Number.isFinite(w) ? w : null, detail: cert };
  }
  return null;
}

export const PART_LABEL: Record<PartSpecs["kind"], string> = {
  gpu: "Placa de vídeo", cpu: "Processador", ram: "Memória RAM", ssd: "SSD", "placa-mae": "Placa-mãe", fonte: "Fonte",
};
