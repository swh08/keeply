import { Pool } from "pg";

declare global {
  var keeplyPostgresPool: Pool | undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: positiveInteger(process.env.PG_POOL_MAX, 10),
    idleTimeoutMillis: positiveInteger(process.env.PG_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: positiveInteger(process.env.PG_CONNECT_TIMEOUT_MS, 5_000),
    options: "-c search_path=auth,public",
    application_name: "keeply",
  });
}

export const pool = globalThis.keeplyPostgresPool ?? createPool();

if (process.env.NODE_ENV !== "production") globalThis.keeplyPostgresPool = pool;
