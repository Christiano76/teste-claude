import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(e: unknown) {
  // Sinais internos do Next (prerender/dynamic bailout) não são erros da aplicação
  unstable_rethrow(e);
  if (e instanceof ZodError) return NextResponse.json({ error: "Parâmetros inválidos", issues: e.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[api]", msg);
  return NextResponse.json({ error: msg }, { status: 500 });
}
