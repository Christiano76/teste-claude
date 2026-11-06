import { Suspense } from "react";
import { OfferView } from "@/components/OfferView";

export default function Page() {
  return (
    <Suspense fallback={<div className="pt-10 text-muted">Carregando análise…</div>}>
      <OfferView />
    </Suspense>
  );
}
