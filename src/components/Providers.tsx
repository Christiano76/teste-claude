"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface Loc { cep: string; uf: string; city: string }
interface Ctx { location: Loc | null; setCep: (cep: string) => Promise<string | null>; clear: () => void }

const LocationCtx = createContext<Ctx>({ location: null, setCep: async () => null, clear: () => {} });
const KEY = "pch_loc";

export function Providers({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<Loc | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setLocation(JSON.parse(raw));
    } catch {
      /* armazenamento indisponível */
    }
  }, []);
  const setCep = useCallback(async (cep: string) => {
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return "CEP deve ter 8 dígitos.";
    const res = await fetch(`/api/cep/${clean}`);
    if (!res.ok) return "CEP não encontrado.";
    const d = await res.json();
    const loc = { cep: d.cep, uf: d.uf, city: d.city };
    setLocation(loc);
    try { localStorage.setItem(KEY, JSON.stringify(loc)); } catch { /* ignore */ }
    return null;
  }, []);
  const clear = useCallback(() => {
    setLocation(null);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, []);
  return <LocationCtx.Provider value={{ location, setCep, clear }}>{children}</LocationCtx.Provider>;
}

export const useLocation = () => useContext(LocationCtx);
