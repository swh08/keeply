import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db/pool";
import { getRequestSession } from "@/lib/auth/session";

export const runtime = "nodejs";

const cursorSchema = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export async function GET(request: Request) {
  const session = await getRequestSession(request);
  if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });

  const url = new URL(request.url);
  const cursor = cursorSchema.safeParse(url.searchParams.get("cursor") ?? "0");
  if (!cursor.success) return NextResponse.json({ code: "INVALID_CURSOR" }, { status: 400 });

  const result = await pool.query<{
    sequence: string;
    entity_type: string;
    entity_id: string;
    action: string;
    payload: unknown;
  }>(
    `select sequence, entity_type, entity_id, action, payload
     from public.sync_changes
     where user_id = $1 and sequence > $2
     order by sequence asc
     limit 500`,
    [session.user.id, cursor.data],
  );

  const changes = result.rows.map((row) => ({
    sequence: Number(row.sequence),
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    payload: row.payload,
  }));
  const nextCursor = changes.at(-1)?.sequence ?? cursor.data;
  return NextResponse.json({ changes, cursor: nextCursor, hasMore: changes.length === 500 });
}
