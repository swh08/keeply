import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const migrationsDirectory = path.resolve("db/migrations");
const appRole = "keeply_app";
const appPassword = process.env.DATABASE_APP_PASSWORD;

if (!appPassword) throw new Error("DATABASE_APP_PASSWORD is required");

const client = new Client({
  connectionString: process.env.MIGRATION_DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  application_name: "keeply-migrator",
});

await client.connect();

try {
  await client.query("select pg_advisory_lock($1)", [741_903_117]);
  await client.query(`
    create table if not exists public.schema_migrations (
      name text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d+.*\.sql$/.test(file))
    .sort();

  for (const file of files) {
    const existing = await client.query("select 1 from public.schema_migrations where name = $1", [file]);
    if (existing.rowCount) continue;
    const sql = await readFile(path.join(migrationsDirectory, file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into public.schema_migrations (name, checksum) values ($1, encode(digest($2, 'sha256'), 'hex'))",
        [file, sql],
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    }
  }

  const roleCommand = await client.query(
    `select case
      when exists (select 1 from pg_roles where rolname = $1::text)
        then format('alter role %I login password %L', $1::text, $2::text)
      else format('create role %I login password %L nosuperuser nocreatedb nocreaterole noinherit', $1::text, $2::text)
    end as command`,
    [appRole, appPassword],
  );
  await client.query(roleCommand.rows[0].command);
  const connectGrant = await client.query("select format('grant connect on database %I to %I', $1::text, $2::text) as command", [client.database, appRole]);
  await client.query(connectGrant.rows[0].command);
  await client.query(`grant usage on schema auth, public to ${appRole}`);
  await client.query(`grant select, insert, update, delete on all tables in schema auth, public to ${appRole}`);
  await client.query(`grant usage, select on all sequences in schema auth, public to ${appRole}`);
  await client.query(`alter default privileges in schema auth grant select, insert, update, delete on tables to ${appRole}`);
  await client.query(`alter default privileges in schema public grant select, insert, update, delete on tables to ${appRole}`);
  await client.query(`alter default privileges in schema auth grant usage, select on sequences to ${appRole}`);
  await client.query(`alter default privileges in schema public grant usage, select on sequences to ${appRole}`);
  await client.query(`revoke all on public.schema_migrations from ${appRole}`);
} finally {
  await client.query("select pg_advisory_unlock($1)", [741_903_117]).catch(() => undefined);
  await client.end();
}
