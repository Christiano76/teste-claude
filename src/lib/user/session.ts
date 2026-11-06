import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { query } from "../db";

const COOKIE = "pch_sid";

function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Sessão anônima: um token aleatório fica num cookie httpOnly e o banco guarda só o hash.
 * Nenhum dado pessoal é exigido; e-mail é opcional e usado apenas para alertas.
 */
export async function getSessionId(create = true): Promise<string | null> {
  const jar = await cookies();
  let token = jar.get(COOKIE)?.value;
  if (!token) {
    if (!create) return null;
    token = randomBytes(32).toString("base64url");
    jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  const id = hash(token);
  await query("INSERT INTO sessions (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET last_seen_at = now()", [id]);
  return id;
}
