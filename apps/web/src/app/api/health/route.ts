import type { HealthResponse } from "@noted/contracts";
import { pool } from "@noted/database";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pool.query("select 1");

    return NextResponse.json<HealthResponse>({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed", error);

    return NextResponse.json<HealthResponse>(
      {
        status: "error",
        database: "unavailable",
      },
      { status: 503 },
    );
  }
}
