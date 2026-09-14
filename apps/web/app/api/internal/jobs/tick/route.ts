import { NextResponse } from "next/server";
import { processJobsForCron } from "@oses/automation";
import { db } from "@oses/database";
import { getEnv, safeEqual } from "@oses/shared";
import { errorResponse } from "@/lib/server/api";

/**
 * Cron entry point for shared hosting: `curl -X POST -H "Authorization: Bearer $INTERNAL_JOB_SECRET" $APP_URL/api/internal/jobs/tick`
 * Runs one scheduler tick and a bounded batch of jobs.
 */
export async function POST(req: Request): Promise<Response> {
  const env = getEnv();
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : new URL(req.url).searchParams.get("secret") ?? "";
  if (!env.INTERNAL_JOB_SECRET || !token || !safeEqual(token, env.INTERNAL_JOB_SECRET)) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Invalid job secret" } }, { status: 403 });
  try {
    const summary = await processJobsForCron(db, { timeBudgetMs: Number(new URL(req.url).searchParams.get("budgetMs") ?? 55_000), maxJobs: Number(new URL(req.url).searchParams.get("maxJobs") ?? 25) });
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = POST;
