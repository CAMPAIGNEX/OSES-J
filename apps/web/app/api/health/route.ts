import { NextResponse } from "next/server";
import { db } from "@oses/database";
import { getEnv } from "@oses/shared";

export async function GET(): Promise<Response> {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", mode: getEnv().JOB_RUNNER_MODE, latencyMs: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, db: "down", error: (err as Error).message }, { status: 503 });
  }
}
