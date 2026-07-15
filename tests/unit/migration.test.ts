import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(path.resolve("db/migrations/0001_initial.sql"), "utf8");
const migrator = readFileSync(path.resolve("scripts/migrate.mjs"), "utf8");

describe("self-hosted PostgreSQL migration", () => {
  it("creates the Better Auth schema and cascades user-owned data", () => {
    expect(sql).toContain('create table auth."user"');
    expect(sql).toContain("create table auth.session");
    expect(sql).toContain("create table auth.account");
    expect(sql).toContain("references auth.\"user\"(id) on delete cascade");
  });
  it("creates indexed, idempotent per-user sync history", () => {
    expect(sql).toContain("operation_id uuid not null unique");
    expect(sql).toContain("sync_changes_user_sequence_idx");
  });
  it("stores amounts as numeric instead of floats", () => { expect(sql).toContain("purchase_amount numeric(20, 6)"); expect(sql).toContain("amount numeric(20, 6)"); expect(sql).not.toMatch(/\b(real|double precision)\b/i); });
  it("provisions a least-privilege application role", () => {
    expect(migrator).toContain('const appRole = "keeply_app"');
    expect(migrator).toContain("revoke all on public.schema_migrations");
    expect(migrator).not.toMatch(/grant\s+(all|superuser)/i);
  });
});
