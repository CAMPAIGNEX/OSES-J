import { NextResponse } from "next/server";
import { db } from "@oses/database";
import { checkEnv, getEnv } from "@oses/shared";

/** Unauthenticated liveness/readiness check: reports configuration (names only) and database reachability. */
export async function GET(): Promise<Response> {
  const started = Date.now();
  const config = checkEnv();
  if (!config.ok) {
    return NextResponse.json({ ok: false, config: { missing: config.missing, invalid: config.invalid, nodeEnv: config.nodeEnv }, hint: "Set the listed environment variables in the hosting panel and redeploy." }, { status: 503 });
  }
  try {
    await db.$queryRaw`SELECT 1`;
    const env = getEnv();
    return NextResponse.json({ ok: true, db: "up", mode: env.JOB_RUNNER_MODE, operatorsConfigured: Boolean(env.SUPER_ADMIN_EMAILS), latencyMs: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, db: "down", error: (err as Error).message, hint: "Check DATABASE_URL (host, user, password, database name) and that remote access is allowed for this database." }, { status: 503 });
  }
}
