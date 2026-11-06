import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { pool } from "./index";
import { seedStores } from "../stores/seed";

export async function migrate(dir = join(process.cwd(), "src/lib/db/migrations")): Promise<string[]> {
  const p = pool();
  await p.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())");
  const done = new Set((await p.query<{ name: string }>("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const c = await p.connect();
    try {
      await c.query("BEGIN");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations(name) VALUES ($1)", [file]);
      await c.query("COMMIT");
      applied.push(file);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  await seedStores();
  return applied;
}
