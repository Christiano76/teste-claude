import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config } from "../config";

declare global {
  var __pchunterPool: Pool | undefined;
}

/** Pool único (reaproveitado entre hot-reloads em dev). */
export function pool(): Pool {
  if (!globalThis.__pchunterPool) {
    globalThis.__pchunterPool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
      max: 5,
    });
  }
  return globalThis.__pchunterPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool().query<T>(sql, params);
  return res.rows;
}

export async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
