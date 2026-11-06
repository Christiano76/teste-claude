"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CepInput } from "./CepInput";

const NAV = [
  { href: "/buscar/pc", label: "PC Gamer" },
  { href: "/buscar/pc-monitor", label: "PC + Monitor" },
  { href: "/buscar/monitor", label: "Monitor" },
  { href: "/buscar/pc?garimpo=1&sort=discount", label: "Garimpo" },
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
