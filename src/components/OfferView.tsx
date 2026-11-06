"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AnalyzedOffer } from "@/lib/types";
import { brl, CONDITION, deliveryText, RISK, scoreColor } from "./format";
import { FavoriteButton } from "./FavoriteButton";
import { PriceChart, type Point } from "./PriceChart";
import { useLocation } from "./Providers";
import { ScoreBadge } from "./ScoreBadge";

interface Resp { item: AnalyzedOffer; sameConfig: AnalyzedOffer[]; history: Point[]; error?: string }

export function OfferView() {
  const { id } = useParams<{ id: string }>();
  const { location } = useLocation();
  const [d, setD] = useState<Resp | null>(null);
  useEffect(() => {
    const qs = location?.cep ? `?cep=${location.cep}` : "";
    fetch(`/api/offers/${id}${qs}`).then((r) => r.json()).then(setD).catch((e) => setD({ error: String(e) } as Resp));
  }, [id, location?.cep]);

  if (!d) return <div className="pt-10 grid gap-6 md:grid-cols-2"><div className="skeleton aspect-square rounded-2xl" /><div className="space-y-3"><div className="skeleton h-8 rounded" /><div className="skeleton h-40 rounded" /></div></div>;
  if (d.error || !d.item) return <div className="pt-10 card p-6 text-bad">{d.error ?? "Oferta não encontrada."}</div>;

  const { offer: o, analysis: a } = d.item;
  const pc = o.specs.pc;
  const m = o.specs.monitor;
  return (
    <div className="pt-6 space-y-6">
      <Link href={o.category === "monitor" ? "/buscar/monitor" : "/buscar/pc"} className="text-sm text-muted hover:text-accent">← voltar à busca</Link>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="card overflow-hidden bg-white/95 aspect-square lg:sticky lg:top-20 self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {o.imageUrl ? <img src={o.imageUrl} alt={o.title} className="w-full h-full object-contain p-6" referrerPolicy="no-referrer" /> : <div className="grid place-items-center h-full text-faint bg-surface">sem imagem</div>}
        </div>
        <div className="space-y-5 min-w-0">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
              <span className="chip">{o.storeName}</span>
              {o.sellerName && o.isMarketplace && o.sellerName !== o.storeName && <span className="chip">vendido por {o.sellerName}</span>}
              {o.brand && <span className="chip">{o.brand}</span>}
              <span className="text-faint">atualizado {new Date(o.lastCheckedAt).toLocaleString("pt-BR")}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold leading-snug">{o.title}</h1>
          </div>

          <div className="card p-5 flex flex-col sm:flex-row gap-5 sm:items-center justify-between">
            <ScoreBadge score={a.score} verdict={a.verdict} size="lg" />
            <div className="sm:text-right">
              {o.listPrice && o.listPrice > o.price && <div className="text-sm text-faint line-through num">{brl(o.listPrice, 2)}</div>}
              <div className="text-3xl font-bold num">{brl(a.cost.productPrice, 2)}</div>
              <div className="text-xs text-muted">à vista{o.installmentPrice ? ` · ${brl(o.installmentPrice, 2)} parcelado` : ""}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary flex-1 !py-3">Comprar na {o.storeName}</a>
            <FavoriteButton offerId={o.id} />
          </div>

          {a.flags.length > 0 && (
            <ul className="card p-4 space-y-1.5 text-sm">
              {a.flags.map((f) => <li key={f.code + f.message} className={f.level === "danger" ? "text-bad" : f.level === "warn" ? "text-mid" : "text-muted"}>{f.level === "info" ? "ℹ" : "⚠"} {f.message}</li>)}
            </ul>
          )}

          <Section title="Três notas independentes">
            <div className="grid sm:grid-cols-3 gap-3">
              {([["Custo-benefício", a.scores.custoBeneficio, a.scoreNotes.custoBeneficio], ["Desconto real", a.scores.desconto, a.scoreNotes.desconto], ["Confiabilidade", a.scores.confiabilidade, a.scoreNotes.confiabilidade]] as const).map(([l, v, n]) => (
                <div key={l} className="bg-surface-2 rounded-lg p-3">
                  <div className="text-xs text-faint">{l}</div>
                  <div className="text-2xl font-bold num" style={{ color: v == null ? "var(--color-faint)" : scoreColor(v) }}>{v ?? "—"}</div>
                  <p className="text-[11px] text-muted mt-1">{n}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted mt-3">Nota geral = 45% custo-benefício + 25% desconto real + 30% confiabilidade, limitada a 35 em alto risco e a 55 quando faltam informações.</p>
          </Section>

          <Section title="Preço de mercado">
            <table className="w-full text-sm"><tbody>
              <Row k="Estado" v={CONDITION[a.condition]} />
              <Row k="Preço médio estimado (neste estado)" v={a.market.price != null ? brl(a.market.price) : null} />
              <Row k="Equivalente novo" v={a.market.newPrice != null ? brl(a.market.newPrice) : null} />
              <Row k="Economia estimada" v={a.market.savings != null ? `${brl(a.market.savings)} (${Math.round((a.market.discount ?? 0) * 100)}%)` : null} />
            </tbody></table>
            <p className="text-xs text-muted mt-2">Base: {a.market.basis}.</p>
          </Section>

          <Section title={`Análise de risco: ${RISK[a.risk.level][0]}`}>
            <ul className="text-sm space-y-1">{a.risk.reasons.map((r) => <li key={r} className="text-muted">• {r}</li>)}</ul>
            <p className="text-[11px] text-faint mt-2">A classificação usa só os dados disponíveis na fonte. Nenhum anúncio é garantido como seguro: confira o vendedor e nunca pague fora da plataforma.</p>
          </Section>

          <Section title="Como a nota foi calculada">
            <div className="space-y-3">
              {a.components.map((c) => (
                <div key={c.key}>
                  <div className="flex justify-between text-sm"><span>{c.label} <span className="text-faint text-xs">peso {c.weight}</span></span><span className="num font-semibold" style={{ color: scoreColor(c.value) }}>{c.value}</span></div>
                  <div className="h-1.5 rounded-full bg-surface-2 mt-1 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.value}%`, background: scoreColor(c.value) }} /></div>
                  <p className="text-xs text-muted mt-1">{c.detail}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Custo final">
            <table className="w-full text-sm"><tbody>
              <Row k="Produto (à vista)" v={brl(a.cost.productPrice, 2)} />
              <Row k="Frete" v={a.cost.shipping == null ? "não verificado" : a.cost.shipping === 0 ? "grátis" : brl(a.cost.shipping, 2)} />
              {a.cost.importTax != null && <Row k="Imposto de Importação (est.)" v={brl(a.cost.importTax, 2)} />}
              {a.cost.icms != null && <Row k="ICMS (est.)" v={brl(a.cost.icms, 2)} />}
              <Row k="Total" v={<b className="num">{brl(a.cost.total, 2)}{!a.cost.totalIsComplete && <span className="text-faint font-normal"> + itens não verificados</span>}</b>} />
              <Row k="Entrega" v={deliveryText(o)} />
              <Row k="Local do vendedor" v={o.sellerLocation} />
              <Row k="Retirada presencial" v={o.pickup == null ? null : o.pickup ? "sim" : "não"} />
              <Row k="Tipo de vendedor" v={o.sellerType === "pessoa-fisica" ? "Pessoa física" : o.sellerType === "profissional" ? "Profissional (CNPJ)" : o.sellerType === "loja" ? "A própria loja" : null} />
              <Row k="Origem" v={o.origin === "BR" ? "Brasil" : o.origin === "INTL" ? "Internacional" : "não verificada"} />
            </tbody></table>
            {a.cost.notes.length > 0 && <ul className="text-xs text-muted mt-3 space-y-0.5">{a.cost.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
          </Section>

          {a.performance && (
            <Section title="Desempenho estimado em jogos">
              <p className="text-sm">{a.performance.tierLabel ?? "Não verificável com os dados do anúncio."}</p>
              {a.performance.perResolution.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-3">
                  {a.performance.perResolution.map((r) => <div key={r.res} className="bg-surface-2 rounded-lg p-3"><div className="text-xs text-faint">{r.res}</div><div className="text-sm font-medium mt-0.5">{r.label}</div></div>)}
                </div>
              )}
              {a.performance.bottleneck && <p className="text-xs text-mid mt-3">{a.performance.bottleneck}</p>}
              <p className="text-[11px] text-faint mt-3">Estimativa para jogos AAA atuais a partir de índices relativos de benchmarks públicos (RTX 4060 + Ryzen 5 5600 ≈ 100). Não é FPS medido.</p>
            </Section>
          )}

          <Section title="Especificações identificadas">
            <table className="w-full text-sm"><tbody>
              {pc && <>
                <Row k="Processador" v={pc.cpu ? `${pc.cpu.model}${pc.cpu.socket ? ` · ${pc.cpu.socket}` : ""}` : null} />
                <Row k="Placa de vídeo" v={pc.gpu ? `${pc.gpu.model}${pc.gpu.vramGb ? ` · ${pc.gpu.vramGb} GB` : ""}` : null} />
                <Row k="Memória RAM" v={pc.ramGb ? `${pc.ramGb} GB${pc.ramType ? ` ${pc.ramType}` : ""}` : null} />
                <Row k="Armazenamento" v={pc.storage.length ? pc.storage.map((s) => `${s.gb >= 1000 ? s.gb / 1000 + " TB" : s.gb + " GB"} ${s.type === "nvme" ? "SSD NVMe" : s.type === "ssd" ? "SSD" : s.type === "hdd" ? "HD" : ""}`).join(" + ") : null} />
                <Row k="Placa-mãe" v={pc.motherboard ? [pc.motherboard.chipset, pc.motherboard.socket].filter(Boolean).join(" · ") : null} />
                <Row k="Fonte" v={pc.psu ? [pc.psu.watts && `${pc.psu.watts} W`, pc.psu.rating].filter(Boolean).join(" · ") : null} />
                <Row k="Sistema" v={pc.os} />
              </>}
              {m && <>
                {pc && <tr><td colSpan={2} className="pt-3 text-xs uppercase tracking-wider text-faint">Monitor incluso</td></tr>}
                <Row k="Tamanho" v={m.sizeIn ? `${m.sizeIn}"` : null} />
                <Row k="Resolução" v={m.width ? `${m.width}×${m.height} (${m.resolutionLabel})` : m.resolutionLabel} />
                <Row k="Frequência" v={m.refreshHz ? `${m.refreshHz} Hz` : null} />
                <Row k="Painel" v={m.panel} />
                <Row k="Tempo de resposta" v={m.responseMs != null ? `${m.responseMs} ms` : null} />
                <Row k="Sincronização" v={m.adaptiveSync} />
                <Row k="HDR" v={m.hdr} />
                <Row k="Conexões" v={m.ports.length ? m.ports.join(", ") : null} />
              </>}
              <Row k="Garantia" v={o.warrantyText} />
              <Row k="Estoque" v={o.available ? (o.stockQty != null ? `${o.stockQty} unidade(s)` : "disponível") : o.available === false ? "indisponível" : null} />
            </tbody></table>
          </Section>

          <Section title="Histórico de preço">
            <PriceChart points={d.history} current={o.price} />
            {a.priceInsight?.message && <p className={`text-sm mt-3 ${a.priceInsight.fakeDiscount ? "text-bad" : a.priceInsight.position === "otimo" || a.priceInsight.position === "bom" ? "text-good" : "text-muted"}`}>{a.priceInsight.message}</p>}
          </Section>

          <AlertForm offerId={o.id} price={o.price} />

          {d.sameConfig.length > 0 && (
            <Section title="Mesma configuração em outras ofertas">
              <ul className="divide-y divide-line">
                {d.sameConfig.map((s) => (
                  <li key={s.offer.id} className="py-2 flex items-center gap-3 text-sm">
                    <span className="num font-semibold w-24 shrink-0">{brl(s.analysis.cost.total)}</span>
                    <Link href={`/oferta/${s.offer.id}`} className="flex-1 truncate hover:text-accent">{s.offer.storeName}{s.offer.sellerName && s.offer.isMarketplace ? ` · ${s.offer.sellerName}` : ""}</Link>
                    <span className="num text-xs" style={{ color: scoreColor(s.analysis.score) }}>{s.analysis.score}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode | null | undefined }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-1.5 pr-4 text-muted align-top w-2/5">{k}</td>
      <td className="py-1.5">{v ?? <span className="text-faint italic">não verificado</span>}</td>
    </tr>
  );
}

function AlertForm({ offerId, price }: { offerId: number; price: number }) {
  const [target, setTarget] = useState(String(Math.floor(price * 0.9)));
  const [email, setEmail] = useState("");
  const [anyStore, setAnyStore] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <Section title="Criar alerta de preço">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        const res = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offerId, targetPrice: Number(target), email: email || undefined, anyStore }) });
        const j = await res.json();
        setMsg(res.ok ? "Alerta criado! Veja em Alertas." : j.error ?? "Erro ao criar alerta.");
      }}>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs text-muted space-y-1 block">Avisar quando custar até (R$)<input className="input num" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          <label className="text-xs text-muted space-y-1 block">E-mail (opcional)<input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[var(--color-accent)]" checked={anyStore} onChange={(e) => setAnyStore(e.target.checked)} /> Valer para a mesma configuração em qualquer loja</label>
        <div className="flex items-center gap-3"><button className="btn btn-primary">Criar alerta</button>{msg && <span className="text-sm text-muted">{msg}</span>}</div>
        <p className="text-[11px] text-faint">Os alertas são verificados a cada atualização agendada. Seu e-mail é usado apenas para o aviso e nunca é compartilhado.</p>
      </form>
    </Section>
  );
}
