"use client";
import Link from "next/link";
import type { AnalyzedOffer } from "@/lib/types";
import { brl, CONDITION, deliveryText, RISK } from "./format";
import { FavoriteButton } from "./FavoriteButton";
import { ScoreBadge } from "./ScoreBadge";

export function specLine(a: AnalyzedOffer): string[] {
  const o = a.offer;
  if (o.category === "monitor" && o.specs.monitor) {
    const m = o.specs.monitor;
    return [m.sizeIn ? `${m.sizeIn}"` : null, m.resolutionLabel, m.refreshHz ? `${m.refreshHz} Hz` : null, m.panel, m.responseMs != null ? `${m.responseMs} ms` : null, m.adaptiveSync].filter(Boolean) as string[];
  }
  const p = o.specs.pc;
  if (!p) return [];
  const sto = p.storage.map((s) => `${s.gb >= 1000 ? `${s.gb / 1000} TB` : `${s.gb} GB`} ${s.type === "nvme" ? "NVMe" : s.type.toUpperCase()}`).join(" + ");
  return [
    p.cpu?.model.replace(/\s*\(.*\)$/, "") ?? "CPU ?",
    p.gpu?.model.replace(/\s*\(presumido.*\)$/, " (integrada)") ?? "GPU não informada",
    p.ramGb ? `${p.ramGb} GB${p.ramType ? " " + p.ramType : ""}` : "RAM ?",
    sto || "armazenamento ?",
    p.psu?.watts ? `Fonte ${p.psu.watts} W${p.psu.rating ? " " + p.psu.rating.replace("80 Plus", "80+") : ""}` : null,
  ].filter(Boolean) as string[];
}

export function OfferCard({ item, index = 0, favorite = false }: { item: AnalyzedOffer; index?: number; favorite?: boolean }) {
  const o = item.offer;
  const a = item.analysis;
  const warn = a.flags.filter((f) => f.level !== "info");
  const fast = (o.delivery?.maxDays ?? 99) <= 3;
  const discount = o.listPrice && o.listPrice > o.price ? Math.round((1 - o.price / o.listPrice) * 100) : null;
  return (
    <article className="card group overflow-hidden flex flex-col hover:border-line-strong transition-colors animate-rise" style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}>
      <Link href={`/oferta/${o.id}`} className="relative block bg-white/95 aspect-[4/3] overflow-hidden">
        {o.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={o.imageUrl} alt="" loading="lazy" className="w-full h-full object-contain p-3 group-hover:scale-[1.03] transition-transform duration-300" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        ) : (
          <div className="w-full h-full grid place-items-center text-faint text-sm bg-surface-2">sem imagem</div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {fast && <span className="chip !bg-good/90 !text-black !border-transparent font-semibold">Entrega rápida</span>}
          {o.freeShipping && <span className="chip !bg-black/75 !text-good !border-transparent">Frete grátis</span>}
          {o.origin === "INTL" && <span className="chip !bg-black/75 !text-mid !border-transparent">Internacional</span>}
          {a.priceInsight?.position === "otimo" && <span className="chip !bg-black/75 !text-accent !border-transparent">Menor preço do histórico</span>}
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-start justify-between gap-3">
          <ScoreBadge score={a.score} verdict={a.verdict} size="md" />
          <FavoriteButton offerId={o.id} initial={favorite} />
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <Mini label="Custo-benef." v={a.scores.custoBeneficio} />
          <Mini label="Desconto real" v={a.scores.desconto} />
          <Mini label="Confiança" v={a.scores.confiabilidade} />
        </div>
        <div className="flex flex-wrap gap-1">
          {o.verification === "api"
            ? <span className="chip !text-good !border-good/40" title="Preço e estoque lidos diretamente da fonte">Preço confirmado</span>
            : <span className="chip !text-mid !border-mid/40" title={o.priceSource ?? "Preço do índice do buscador"}>Preço não confirmado</span>}
          <span className={`chip ${a.condition === "novo" ? "" : "!text-accent-2 !border-accent-2/40"}`}>{CONDITION[a.condition]}</span>
          {a.delivery.protection && <span className="chip !text-good !border-good/40" title={a.delivery.protection}>Proteção ao comprador</span>}
          <span className="chip" style={{ color: RISK[a.risk.level][1], borderColor: "currentColor" }} title={a.risk.reasons.join(" ")}>{RISK[a.risk.level][0]}</span>
        </div>
        <Link href={`/oferta/${o.id}`} className="text-sm font-medium leading-snug line-clamp-2 hover:text-accent" title={o.title}>{o.title}</Link>
        <div className="flex flex-wrap gap-1">{specLine(item).slice(0, 6).map((s) => <span key={s} className="chip">{s}</span>)}</div>
        {a.usage && (
          <div className="flex flex-wrap gap-1" aria-label="Indicado para (estimativa)">
            {a.usage.filter((u) => u.level === "adequado" || u.level === "limitado").map((u) => (
              <span key={u.use} className={`chip ${u.level === "adequado" ? "!text-good !border-good/30" : "!text-mid !border-mid/30"}`} title={`${u.note} (estimativa)`}>{u.use}{u.level === "limitado" ? " (limitado)" : ""}</span>
            ))}
          </div>
        )}
        {a.performance?.tierLabel && <p className="text-xs text-muted">{a.performance.tierLabel}</p>}
        <div className="mt-auto space-y-2">
          <div className="flex items-end justify-between gap-2">
            <div>
              {o.listPrice && discount ? <div className="text-xs text-faint line-through num">{brl(o.listPrice)}</div> : null}
              <div className="text-2xl font-bold num tracking-tight">{brl(a.cost.productPrice)}</div>
              <div className="text-[11px] text-muted">à vista{o.installmentPrice ? ` · ${brl(o.installmentPrice)} parcelado` : ""}</div>
            </div>
            {discount ? <span className={`chip ${a.priceInsight?.fakeDiscount ? "!text-bad !border-bad/40" : "!text-good !border-good/40"}`}>−{discount}%{a.priceInsight?.fakeDiscount ? " suspeito" : ""}</span> : null}
          </div>
          <div className="text-xs text-muted space-y-0.5">
            {a.market.price != null && <div className="flex justify-between gap-2"><span>Média de mercado</span><span className="num">{brl(a.market.price)}{a.market.comparables === 0 && <span className="text-faint"> (est.)</span>}</span></div>}
            {a.market.savings != null && a.market.savings > 0 && <div className="flex justify-between gap-2"><span>Economia estimada</span><span className="num text-good">{brl(a.market.savings)} ({Math.round((a.market.discount ?? 0) * 100)}%)</span></div>}
            <div className="flex justify-between gap-2"><span>Custo final</span><span className="num text-fg">{brl(a.cost.total)}{!a.cost.totalIsComplete && <span className="text-faint"> + frete</span>}</span></div>
            {a.cost.importTax != null && <div className="flex justify-between"><span>Impostos (est.)</span><span className="num">{brl((a.cost.importTax ?? 0) + (a.cost.icms ?? 0))}</span></div>}
            <div className="flex justify-between gap-2"><span>Envio</span><span className={`text-right ${a.delivery.deliverable === true ? "text-good" : a.delivery.deliverable === false ? "text-bad" : "text-faint"}`}>{a.delivery.mode === "envio-nacional" ? "nacional" : a.delivery.mode === "envio-local" ? "só local" : a.delivery.mode === "internacional" ? "internacional" : a.delivery.mode === "retirada" ? "só retirada" : a.delivery.mode === "sem-envio" ? "sem envio" : "não confirmado"}</span></div>
            <div className="flex justify-between gap-2"><span>Frete</span><span className="text-right">{a.cost.shipping == null ? <span className="text-faint">Frete não verificado</span> : a.cost.shipping === 0 ? "grátis" : brl(a.cost.shipping, 2)}</span></div>
            <div className="flex justify-between gap-2"><span>Prazo</span><span className="text-right">{deliveryText(o)}</span></div>
            <div className="flex justify-between gap-2"><span>Local do vendedor</span><span>{o.sellerLocation ?? "não informado"}{o.pickup ? " · retirada" : ""}</span></div>
            <div className="flex justify-between gap-2"><span>{o.verification === "api" ? "Verificado em" : "Encontrado em"}</span><span className="num">{new Date(o.lastCheckedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></div>
            {o.indexedAt && <div className="flex justify-between gap-2"><span>Indexado pelo buscador</span><span className="num">{new Date(o.indexedAt).toLocaleDateString("pt-BR")}</span></div>}
            <div className="flex justify-between gap-2"><span>Origem</span><span className="text-right truncate">{o.platform ?? o.storeName}</span></div>
            <div className="flex justify-between gap-2"><span>Loja</span><span className="text-right truncate max-w-[65%]" title={a.storeReputation.basis}>{o.storeName}{o.sellerName && o.isMarketplace && o.sellerName !== o.storeName ? ` · ${o.sellerName}` : ""} · <span className={a.storeReputation.score >= 72 ? "text-good" : a.storeReputation.score >= 58 ? "text-mid" : "text-bad"}>{a.storeReputation.label}</span></span></div>
          </div>
          {warn.length > 0 && (
            <ul className="text-[11px] space-y-0.5">
              {warn.slice(0, 2).map((f) => <li key={f.code} className={f.level === "danger" ? "text-bad" : "text-mid"}>⚠ {f.message}</li>)}
            </ul>
          )}
          {item.alsoAt.length > 0 && <p className="text-[11px] text-faint">Mesma configuração em mais {item.alsoAt.length} oferta(s) a partir de {brl(Math.min(...item.alsoAt.map((x) => x.price)))}</p>}
          <div className="flex gap-2 pt-1">
            <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary flex-1">Ver oferta</a>
            <Link href={`/oferta/${o.id}`} className="btn btn-ghost">Análise</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function Mini({ label, v }: { label: string; v: number | null }) {
  const c = v == null ? "var(--color-faint)" : v >= 75 ? "var(--color-good)" : v >= 60 ? "var(--color-mid)" : "var(--color-bad)";
  return (
    <div className="rounded-lg bg-surface-2 py-1.5">
      <div className="text-sm font-bold num" style={{ color: c }}>{v ?? "—"}</div>
      <div className="text-[10px] text-faint leading-tight">{label}</div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton aspect-[4/3]" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-10 w-24 rounded-full" />
        <div className="skeleton h-4 rounded" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-8 w-1/2 rounded" />
      </div>
    </div>
  );
}
