import { NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";

export const runtime = "nodejs";

export async function GET() {
  try {
    await pool.query("select 1");
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
