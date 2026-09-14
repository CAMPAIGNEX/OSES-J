import { executeSearchRun, finalizeSearchRun } from "@oses/discovery";
import { enrichLeads } from "@oses/enrichment";
import type { JobContext } from "../runner";

/** DISCOVERY_JOB: run providers for a SearchRun, persist leads, enqueue enrichment. */
export async function handleDiscoveryJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const searchRunId = String(ctx.payload.searchRunId ?? "");
  const run = await ctx.db.searchRun.findUnique({ where: { id: searchRunId } });
  if (!run) return { skipped: "search run not found" };
  if (run.status === "CANCELLED") return { skipped: "cancelled" };
  if (run.status === "COMPLETED") return { skipped: "already completed" };
  const result = await executeSearchRun(ctx.db, searchRunId);
  const criteria = run.criteria as { enrich?: boolean };
  const toEnrich = [...new Set([...result.persisted.needsProfileEnrichment, ...result.persisted.needsWebsiteEnrichment])];
  if (criteria.enrich !== false && toEnrich.length && result.run.status === "ENRICHING") {
    // Batches of 25 keep single Actor runs short and let results stream into the UI.
    for (let i = 0; i < toEnrich.length; i += 25) {
      const batch = toEnrich.slice(i, i + 25);
      await ctx.queue.enqueue({ type: "ENRICHMENT_JOB", organizationId: run.organizationId, payload: { searchRunId, leadIds: batch, profile: true, website: true, batchIndex: i / 25, batchCount: Math.ceil(toEnrich.length / 25) }, priority: 4, parentJobId: ctx.job.id, entityType: "SearchRun", entityId: searchRunId });
    }
  } else if (result.run.status === "ENRICHING") {
    await finalizeSearchRun(ctx.db, searchRunId, 0);
  }
  return { created: result.persisted.created, matched: result.persisted.matched, enrichmentQueued: toEnrich.length, warnings: result.warnings.slice(0, 10) };
}

/** ENRICHMENT_JOB: enrich a batch of leads (profile details + website contacts). */
export async function handleEnrichmentJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const organizationId = ctx.organizationId;
  if (!organizationId) return { skipped: "no organization" };
  const leadIds = Array.isArray(ctx.payload.leadIds) ? (ctx.payload.leadIds as string[]) : [];
  const searchRunId = (ctx.payload.searchRunId as string | undefined) ?? null;
  if (!leadIds.length) return { skipped: "no leads" };
  const summary = await enrichLeads(ctx.db, organizationId, leadIds, { profile: ctx.payload.profile !== false, website: ctx.payload.website !== false });
  if (searchRunId) {
    const remaining = await ctx.db.automationJob.count({ where: { type: "ENRICHMENT_JOB", status: { in: ["QUEUED", "RUNNING"] }, entityType: "SearchRun", entityId: searchRunId, NOT: { id: ctx.job.id } } });
    if (remaining === 0) await finalizeSearchRun(ctx.db, searchRunId, summary.profileEnriched + summary.websiteEnriched);
    else await ctx.db.searchRun.updateMany({ where: { id: searchRunId, status: "ENRICHING" }, data: { totalEnriched: { increment: summary.profileEnriched + summary.websiteEnriched } } });
  }
  return { ...summary, warnings: summary.warnings.slice(0, 10) };
}
