import type { MonitorSpecs, PcSpecs } from "../types";
import { findGpuByName } from "./gpus";

export interface PcPerformance {
  /** Índice efetivo de jogos (≈100 para RTX 4060 + Ryzen 5 5600 + 16 GB). null = não verificável. */
  gamingIndex: number | null;
  cpuFactor: number | null;
  ramFactor: number;
  tierLabel: string | null;
  perResolution: { res: string; label: string }[];
  bottleneck: string | null;
  /** Consumo estimado do sistema em W (para dimensionar fonte). */
  estimatedDrawW: number | null;
}

/** CPU necessária para não limitar uma GPU de índice G (escala CPU: R5 5600 = 100). */
export function requiredCpu(gpuIndex: number): number {
  return 60 + 0.4 * gpuIndex;
}

function qualityAt(v: number): string {
  if (v >= 130) return "ultra com alta taxa de quadros";
  if (v >= 90) return "ultra";
  if (v >= 65) return "alto";
  if (v >= 42) return "médio";
  if (v >= 25) return "baixo";
  return "não recomendado para jogos atuais";
}

export function tierLabel(e: number): string {
  if (e >= 220) return "Entusiasta — 4K alto, 1440p ultra com folga";
  if (e >= 150) return "Alto desempenho — 1440p ultra, 4K médio";
  if (e >= 100) return "Intermediário forte — 1080p ultra, 1440p alto";
  if (e >= 70) return "Intermediário — 1080p alto";
  if (e >= 45) return "Entrada — 1080p médio";
  if (e >= 25) return "Básico — 1080p baixo / e-sports";
  return "Muito fraco para jogos — apenas títulos leves";
}

export function pcPerformance(pc: PcSpecs): PcPerformance {
  const G = pc.gpu?.index ?? null;
  const C = pc.cpu?.index ?? null;
  const ramFactor = pc.ramGb == null ? 0.92 : pc.ramGb >= 16 ? 1 : pc.ramGb >= 12 ? 0.94 : pc.ramGb >= 8 ? 0.85 : 0.7;
  const gpuRef = pc.gpu && !pc.gpu.integrated ? findGpuByName(pc.gpu.model) : null;
  const estimatedDrawW = gpuRef ? gpuRef.watts + 110 + 50 : pc.gpu?.integrated ? 160 : null;

  if (G == null) {
    return { gamingIndex: null, cpuFactor: null, ramFactor, tierLabel: null, perResolution: [], bottleneck: null, estimatedDrawW };
  }
  const req = requiredCpu(G);
  const cpuFactor = C == null ? 0.85 : Math.min(1, Math.pow(C / req, 0.6));
  const E = Math.round(G * cpuFactor * ramFactor * 10) / 10;

  let bottleneck: string | null = null;
  if (C != null && C < req * 0.75) bottleneck = `O processador limita a placa de vídeo (aproveitamento estimado de ${Math.round(cpuFactor * 100)}%).`;
  else if (C != null && G < 25 && C >= 80) bottleneck = "Placa de vídeo muito fraca para o processador — configuração desbalanceada.";
  else if (C == null) bottleneck = "Modelo do processador não informado: desempenho estimado com margem de segurança.";
  if (pc.ramGb != null && pc.ramGb < 16) bottleneck = (bottleneck ? bottleneck + " " : "") + `${pc.ramGb} GB de RAM limitam jogos atuais (recomendado 16 GB+).`;

  const perResolution = [
    { res: "1080p", label: qualityAt(E) },
    { res: "1440p", label: qualityAt(E * 0.68) },
    { res: "4K", label: qualityAt(E * 0.38) },
  ];
  return { gamingIndex: E, cpuFactor, ramFactor, tierLabel: tierLabel(E), perResolution, bottleneck, estimatedDrawW };
}

/** Pontuação de qualidade técnica do monitor (0–100). */
export function monitorQuality(m: MonitorSpecs): number {
  const res: Record<string, number> = { "4K": 35, "Ultrawide 1440p": 32, "1440p": 28, "Ultrawide 1080p": 20, "1080p": 16, "900p": 8, "720p": 4 };
  let q = m.resolutionLabel ? res[m.resolutionLabel] ?? 10 : 10;
  const hz = m.refreshHz;
  q += hz == null ? 4 : hz >= 360 ? 25 : hz >= 240 ? 22 : hz >= 165 ? 18 : hz >= 144 ? 16 : hz >= 120 ? 12 : hz >= 100 ? 9 : hz >= 75 ? 5 : 2;
  const panel: Record<string, number> = { OLED: 20, "QD-OLED": 20, "Mini-LED": 17, IPS: 13, VA: 10, TN: 5 };
  q += m.panel ? panel[m.panel] : 6;
  q += m.responseMs == null ? 2 : m.responseMs <= 1 ? 6 : m.responseMs <= 4 ? 4 : 1;
  if (m.adaptiveSync) q += 5;
  if (m.hdr) q += /(400|600|1000|true black)/i.test(m.hdr) ? 4 : 2;
  // densidade de pixels: 1080p acima de 27" fica granulado
  if (m.sizeIn && m.resolutionLabel === "1080p" && m.sizeIn > 27) q -= 4;
  if (m.sizeIn && m.sizeIn < 21) q -= 3;
  return Math.max(0, Math.min(100, Math.round((q / 95) * 100)));
}

/** Monitor adequado ao PC? Retorna observações de pareamento. */
export function pairingNotes(gamingIndex: number | null, m: MonitorSpecs): { fit: number; notes: string[] } {
  const notes: string[] = [];
  if (gamingIndex == null || !m.resolutionLabel) return { fit: 0.8, notes: ["Pareamento não verificável (dados incompletos)."] };
  const needs: Record<string, number> = { "4K": 200, "Ultrawide 1440p": 160, "1440p": 120, "Ultrawide 1080p": 90, "1080p": 45, "900p": 25, "720p": 15 };
  const need = needs[m.resolutionLabel] ?? 60;
  let fit = 1;
  if (gamingIndex < need * 0.7) {
    fit = 0.7;
    notes.push(`PC fraco para ${m.resolutionLabel}: espere qualidade baixa nessa resolução.`);
  } else if (gamingIndex > need * 2.2 && (m.refreshHz ?? 60) < 144) {
    fit = 0.85;
    notes.push("Monitor limita o PC: considere maior resolução ou taxa de atualização.");
  } else {
    notes.push(`Boa combinação para ${m.resolutionLabel}${m.refreshHz ? ` ${m.refreshHz} Hz` : ""}.`);
  }
  if ((m.refreshHz ?? 60) >= 144 && gamingIndex < 50) notes.push("O PC dificilmente atinge a taxa de atualização do monitor em jogos atuais.");
  return { fit, notes };
}
