import Link from "next/link";
import { CepInput } from "@/components/CepInput";
import { HomeStats } from "@/components/HomeStats";

const MODES = [
  { href: "/buscar/pc", step: "01", title: "Procurar PC Gamer", text: "PCs completos prontos para jogar. Identificamos CPU, GPU, RAM, armazenamento e fonte, estimamos o desempenho e apontamos peças desproporcionais.", icon: "pc" },
  { href: "/buscar/pc-monitor", step: "02", title: "PC Gamer + Monitor", text: "Kits e combinações compradas separadamente. Somamos o custo final e mostramos se comprar separado compensa mais que o kit.", icon: "combo" },
  { href: "/buscar/monitor", step: "03", title: "Procurar Monitor", text: "Resolução, tamanho, painel, frequência, tempo de resposta e conexões comparados contra o preço de mercado.", icon: "monitor" },
];

function Icon({ kind }: { kind: string }) {
  const common = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "monitor") return <svg {...common}><rect x="2" y="4" width="20" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></svg>;
  if (kind === "combo") return <svg {...common}><rect x="1.5" y="5" width="13" height="9" rx="1.5" /><path d="M5 18h6M8 14v4" /><rect x="17" y="3" width="5.5" height="17" rx="1.2" /><circle cx="19.75" cy="16.5" r=".8" /></svg>;
  return <svg {...common}><rect x="6" y="2" width="12" height="20" rx="2" /><circle cx="12" cy="16" r="2" /><path d="M9 6h6M9 9h6" /></svg>;
}

export default function Home() {
  return (
    <div className="pt-10 sm:pt-16 space-y-14">
      <section className="max-w-3xl">
        <span className="chip !text-accent !border-accent/30 mb-5">Minerador de ofertas · entrega no Brasil</span>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08]">
          Não o mais barato. <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">O que realmente vale a pena.</span>
        </h1>
        <p className="mt-5 text-muted text-base sm:text-lg leading-relaxed">
          O PC Hunter coleta ofertas reais, calcula o custo final com frete e impostos, estima o desempenho em jogos e dá uma nota de 0 a 100 para cada oportunidade.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm text-muted">Informe seu CEP para personalizar frete e impostos:</span>
          <CepInput />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {MODES.map((m, i) => (
          <Link key={m.href} href={m.href} className="card group p-6 flex flex-col gap-4 hover:border-accent/50 transition-all hover:-translate-y-0.5 animate-rise" style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex items-center justify-between">
              <span className="text-accent"><Icon kind={m.icon} /></span>
              <span className="text-xs font-mono text-faint">ETAPA {m.step}</span>
            </div>
            <h2 className="text-xl font-semibold">{m.title}</h2>
            <p className="text-sm text-muted leading-relaxed flex-1">{m.text}</p>
            <span className="text-sm font-semibold text-accent group-hover:translate-x-1 transition-transform">Buscar →</span>
          </Link>
        ))}
      </section>

      <HomeStats />

      <section className="grid gap-6 md:grid-cols-4 text-sm">
        {[
          ["Nota 0–100", "Custo final, desempenho, qualidade das peças, equilíbrio, loja, garantia, estoque, entrega e upgrade."],
          ["Custo final real", "Frete para o seu CEP quando a fonte permite, e impostos de importação estimados para produtos internacionais."],
          ["Histórico de preços", "Cada coleta gera um registro. Detectamos promoções com preço “de” inflado e avisamos quando o preço cai."],
          ["Sem invenções", "Dado que a fonte não informa aparece como “não verificado” — e a nota é limitada."],
        ].map(([t, d]) => (
          <div key={t} className="border-l border-line-strong pl-4">
            <h3 className="font-semibold mb-1">{t}</h3>
            <p className="text-muted leading-relaxed">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
