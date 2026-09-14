import { cancelSearchRun, getSearchRun } from "@oses/discovery";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const run = await getSearchRun(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
  const [leadCount, providerRuns, job] = await Promise.all([
    ctx.db.searchRunLead.count({ where: { searchRunId: run.id } }),
    ctx.db.providerRun.findMany({ where: { searchRunId: run.id }, orderBy: { createdAt: "asc" }, select: { id: true, actorId: true, adapter: true, purpose: true, status: true, itemCount: true, costUsd: true, error: true, externalRunId: true, startedAt: true, finishedAt: true } }),
    run.jobId ? ctx.db.automationJob.findUnique({ where: { id: run.jobId }, select: { status: true, error: true, attempts: true, scheduledAt: true } }) : null,
  ]);
  return { run: { ...run, providerRuns, job, leadCount } };
});

export const DELETE = withApi(async (ctx) => {
  await cancelSearchRun(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
  return { ok: true };
});
