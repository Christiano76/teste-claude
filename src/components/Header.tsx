"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CepInput } from "./CepInput";

const NAV = [
  { href: "/buscar/pc", label: "PC completo" },
  { href: "/buscar/pc-monitor", label: "PC + Monitor" },
  { href: "/buscar/monitor", label: "Monitor" },
  { href: "/buscar/peca", label: "Peças" },
  { href: "/buscar/kit", label: "Kits" },
  { href: "/buscar/garimpo-entrega", label: "Garimpo c/ entrega" },
  { href: "/radar", label: "Radar" },
  { href: "/favoritos", label: "Favoritos" },
  { href: "/alertas", label: "Alertas" },
  { href: "/fontes", label: "Fontes" },
];

export function Header() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight shrink-0">
          <Logo />
          <span>PC <span className="text-accent">Hunter</span></span>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`px-3 py-1.5 rounded-lg transition-colors ${path?.startsWith(n.href.split("?")[0]) && !n.href.includes("garimpo") ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden sm:block"><CepInput compact /></div>
        <ThemeToggle />
        <button className="lg:hidden ml-auto sm:ml-2 p-2 text-muted" aria-label="Menu" onClick={() => setOpen(!open)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        </button>
      </div>
      {open && (
        <div className="lg:hidden border-t border-line px-4 py-3 space-y-1 bg-bg">
          <div className="sm:hidden pb-2"><CepInput compact /></div>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-muted hover:bg-surface-2 hover:text-fg">{n.label}</Link>
          ))}
        </div>
      )}
    </header>
  );
}

function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    let t: string | null = null;
    try { t = localStorage.getItem("pch_theme"); } catch { /* sem armazenamento */ }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLight(t === "light");
    document.documentElement.dataset.theme = t === "light" ? "light" : "dark";
  }, []);
  return (
    <button type="button" className="p-2 text-muted hover:text-fg shrink-0" aria-label={light ? "Usar tema escuro" : "Usar tema claro"} title={light ? "Tema escuro" : "Tema claro"}
      onClick={() => {
        const next = !light;
        setLight(next);
        document.documentElement.dataset.theme = next ? "light" : "dark";
        try { localStorage.setItem("pch_theme", next ? "light" : "dark"); } catch { /* ignore */ }
      }}>
      {light
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
        : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>}
    </button>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <defs><linearGradient id="lg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#2ee6c5" /><stop offset="1" stopColor="#5b8cff" /></linearGradient></defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="none" stroke="url(#lg)" strokeWidth="2.5" />
      <circle cx="15" cy="15" r="6" fill="none" stroke="url(#lg)" strokeWidth="2.5" />
      <path d="M19.5 19.5L25 25" stroke="url(#lg)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
