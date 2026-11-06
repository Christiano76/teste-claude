import { describe, expect, it } from "vitest";
import { parseCpu } from "@/lib/hardware/cpus";
import { matchGpu } from "@/lib/hardware/gpus";
import { pcPerformance } from "@/lib/hardware/performance";
import { isAccessory, parseMonitor, parseSpecs } from "@/lib/hardware/specs";

// Títulos reais coletados da KaBuM! em 06/11/2026
describe("parser de PCs", () => {
  it("identifica CPU, GPU com VRAM colada, RAM e armazenamento", () => {
    const s = parseSpecs("PC Gamer Aquário Preto | Ryzen 7 5700x | RTX 5060 8GB | 16gb Ram | SSD 1TB | Water Cooler 240mm", null, null);
    expect(s.pc?.cpu?.model).toBe("Ryzen 7 5700X");
    expect(s.pc?.gpu?.model).toBe("RTX 5060");
    expect(s.pc?.ramGb).toBe(16);
    expect(s.pc?.storage).toEqual([{ type: "ssd", gb: 1000 }]);
  });

  it("não confunde VRAM com RAM e separa SSD de outros GB", () => {
    const s = parseSpecs("PC Gamer Ryzen 5 5500 RTX 3050 Ventus 6gb SSD 480GB 16gb Ram", null, null);
    expect(s.pc?.ramGb).toBe(16);
    expect(s.pc?.storage).toEqual([{ type: "ssd", gb: 480 }]);
    expect(s.pc?.gpu?.index).toBe(62);
  });

  it("geração sem modelo exato fica sinalizada", () => {
    const c = parseCpu("PC Gamer I5 3° Gtx 1650 Memória 16gb SSD 512gb");
    expect(c?.model).toMatch(/3ª geração \(modelo exato não informado\)/);
    expect(c?.generationAge).toBe("obsolete");
  });

  it("diferencia Ryzen 5 7600 de Core i5-7600", () => {
    expect(parseCpu("Ryzen 5 7600")?.index).toBe(128);
    expect(parseCpu("Core i5-7600")?.index).toBe(58);
  });

  it("não troca RTX 4060 Ti por RTX 4060", () => {
    expect(matchGpu("Geforce RTX 4060 Ti 8GB")?.name).toBe("RTX 4060 Ti");
    expect(matchGpu("RTX4060 8GB")?.name).toBe("RTX 4060");
    expect(matchGpu("RX 7900 XTX")?.name).toBe("RX 7900 XTX");
  });

  it("fonte e certificação", () => {
    const s = parseSpecs("PC Gamer Completo Ryzen 5 5500, RTX 3050, 16gb Ddr4, SSD 480GB, 600w 80 Plus", null, null);
    expect(s.pc?.psu).toMatchObject({ watts: 600, rating: "80 Plus" });
  });

  it("vídeo integrado presumido quando nenhuma GPU é citada", () => {
    const s = parseSpecs("Computador Cpu Intel Core i3 2120 16gb Ddr3 SSD 512gb Gabinete Gamer Fonte 500w", null, null);
    expect(s.pc?.gpu?.integrated).toBe(true);
    expect(s.pc?.gpu?.model).toMatch(/presumido/);
  });

  it("detecta kit com monitor", () => {
    const s = parseSpecs("PC Gamer Intel I7, 32GB DDR4, SSD 1TB, Windows 10 Pro + Monitor LED 24 Polegadas", null, null);
    expect(s.pc?.includesMonitor).toBe(true);
    expect(s.pc?.monitor?.sizeIn).toBe(24);
  });

  it("descarta acessórios", () => {
    expect(isAccessory("Gabinete Gamer Crypton Eclipse, 3 Fans ARGB")).toBe(true);
    expect(isAccessory("Filtro De Privacidade Para Monitores 20\"")).toBe(true);
    expect(isAccessory("PC Gamer Ryzen 5 5600")).toBe(false);
  });
});

describe("parser de monitores", () => {
  it("extrai todas as especificações", () => {
    const m = parseMonitor("Monitor Gamer Asus Tuf 27 Pol, Qhd, 210hz, 0.3ms, Fast Ips, G-sync Compatible, Freesync Premium, Hdr10");
    expect(m).toMatchObject({ sizeIn: 27, resolutionLabel: "1440p", refreshHz: 210, panel: "IPS", responseMs: 0.3 });
    expect(m.adaptiveSync).toContain("FreeSync Premium");
  });
  it("HD+ é 900p", () => {
    expect(parseMonitor('Monitor LED 19" HD+ 75Hz 5ms').resolutionLabel).toBe("900p");
  });
});

describe("desempenho", () => {
  it("referência RTX 4060 + R5 5600 + 16GB ≈ 100", () => {
    const s = parseSpecs("PC Gamer Ryzen 5 5600, RTX 4060, 16gb, SSD 1TB", null, null);
    expect(pcPerformance(s.pc!).gamingIndex).toBeCloseTo(100, 0);
  });
  it("aponta gargalo de CPU antiga com GPU forte", () => {
    const s = parseSpecs("PC Gamer Intel Core i5 4590, RTX 4070 Super, 16gb, SSD 1TB", null, null);
    const p = pcPerformance(s.pc!);
    expect(p.bottleneck).toMatch(/processador limita/);
    expect(p.gamingIndex!).toBeLessThan(110);
  });
});
