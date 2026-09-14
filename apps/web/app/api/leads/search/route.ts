import { createSearchRun, listSearchRuns, resolveProviders } from "@oses/discovery";
import { searchCriteriaSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";
import { enqueueJob } from "@/lib/server/jobs";

/** Start a lead search: creates the SearchRun and queues the DISCOVERY_JOB. */
export const POST = withApi(
  async (ctx) => {
    const { run, criteria } = await createSearchRun(ctx.db, serviceContext(ctx), ctx.body);
    const providers = await resolveProviders(ctx.db, ctx.organizationId);
    const job = await enqueueJob({ type: "DISCOVERY_JOB", organizationId: ctx.organizationId, payload: { searchRunId: run.id }, priority: 2, entityType: "SearchRun", entityId: run.id });
    await ctx.db.searchRun.update({ where: { id: run.id }, data: { jobId: job.id } });
    return { searchRunId: run.id, criteria, warnings: providers.warnings, providersConfigured: providers.discovery.length };
  },
  { body: searchCriteriaSchema },
);

export const GET = withApi(async (ctx) => {
  const runs = await listSearchRuns(ctx.db, serviceContext(ctx), Number(ctx.query.get("take") ?? 20));
  return { items: runs };
});
