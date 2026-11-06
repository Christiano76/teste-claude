import { Suspense } from "react";
import { SearchView } from "@/components/SearchView";

export function generateStaticParams() {
  return [{ modo: "pc" }, { modo: "pc-monitor" }, { modo: "monitor" }, { modo: "kit" }, { modo: "garimpo-entrega" }];
}

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-10 text-muted">Carregando…</div>}>
      <SearchView />
    </Suspense>
  );
}
