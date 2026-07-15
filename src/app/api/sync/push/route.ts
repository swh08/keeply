import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { pool } from "@/lib/db/pool";
import { applySyncOperation, SyncConflictError } from "@/lib/db/sync-repository";
import { getRequestSession } from "@/lib/auth/session";
import { pushSyncSchema } from "@/lib/validation/sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = pushSyncSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ code: "INVALID_SYNC_BATCH", issues: parsed.error.issues }, { status: 400 });

  const client = await pool.connect();
  const accepted: string[] = [];
  const failed: Array<{ id: string; code: string; message: string }> = [];
  let cursor = 0;

  try {
    await client.query("begin");
    for (const [index, operation] of parsed.data.operations.entries()) {
      const savepoint = `sync_operation_${index}`;
      await client.query(`savepoint ${savepoint}`);
      try {
        cursor = Math.max(cursor, await applySyncOperation(client, session.user.id, operation));
        accepted.push(operation.id);
        await client.query(`release savepoint ${savepoint}`);
      } catch (error) {
        await client.query(`rollback to savepoint ${savepoint}`);
        failed.push({
          id: operation.id,
          code: error instanceof SyncConflictError ? "CONFLICT" : error instanceof ZodError ? "INVALID_PAYLOAD" : "WRITE_FAILED",
          message: error instanceof Error ? error.message : "Sync operation failed",
        });
      }
    }
    await client.query("commit");
  } catch {
    await client.query("rollback").catch(() => undefined);
    return NextResponse.json({ code: "SYNC_UNAVAILABLE" }, { status: 503 });
  } finally {
    client.release();
  }

  return NextResponse.json({ accepted, failed, cursor });
}
