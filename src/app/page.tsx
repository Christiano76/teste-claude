import Link from "next/link";
import { CepInput } from "@/components/CepInput";
import { HomeSearch } from "@/components/HomeSearch";
import { HomeStats } from "@/components/HomeStats";

const MODES = [
  { href: "/buscar/pc", step: "MODO 1", title: "PC completo", text: "Informe o orçamento (ex.: R$ 500). Entram PCs usados, antigos, de escritório, gamers e recondicionados — de lojas e de pessoas físicas.", icon: "pc" },
  { href: "/buscar/pc-monitor", step: "MODO 2", title: "PC + monitor", text: "Kits e combinações de anúncios separados dentro do orçamento total, com frete quando conhecido.", icon: "combo" },
  { href: "/buscar/monitor", step: "MODO 3", title: "Apenas monitor", text: "Resolução, tamanho, frequência, painel e conexões — os mais baratos que atendem aos seus requisitos.", icon: "monitor" },
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
        <span className="chip !text-accent !border-accent/30 mb-5">PC Hunter · Garimpo inteligente de computadores</span>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-balance">
          Garimpe seu próximo PC <span className="bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">pelo menor preço possível.</span>
        </h1>
        <p className="mt-5 text-muted text-base sm:text-lg leading-relaxed">
          Anúncios reais de lojas, marketplaces e classificados — com custo total, estado de conservação, desempenho estimado e alertas de risco. Cada resultado diz se o preço e o frete foram confirmados.
        </p>
        <div className="mt-6"><HomeSearch /></div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <span className="text-sm text-muted">CEP de entrega:</span>
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
