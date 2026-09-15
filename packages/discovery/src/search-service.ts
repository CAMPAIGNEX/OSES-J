import type { DbClient, SearchRun } from "@oses/database";
import { recordUsage, writeAudit } from "@oses/database";
import { createLogger, errorMessage, NotFoundError } from "@oses/shared";
import type { SearchCriteriaRequest } from "@oses/validation";
import { persistDiscoveredLeads, type PersistBatchResult } from "./lead-repository";
import { DiscoveryOrchestrator } from "./orchestrator";
import { resolveProviders } from "./provider-registry";
import { buildSearchCriteria } from "./query-parser";
import type { DiscoveryProvider, ProviderRunMeta, SearchCriteria } from "./types";

const log = createLogger("discovery.search");

export interface RequestContext {
  organizationId: string;
  userId?: string | null;
}

/** Create the SearchRun row. The caller (API layer) enqueues the DISCOVERY_JOB that executes it. */
export async function createSearchRun(db: DbClient, ctx: RequestContext, request: SearchCriteriaRequest): Promise<{ run: SearchRun; criteria: SearchCriteria }> {
  const criteria = buildSearchCriteria(request);
  const input = { ...request, limit: criteria.limit, platform: request.platform ?? "INSTAGRAM" };
  const run = await db.searchRun.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.userId ?? null,
      savedSearchId: input.savedSearchId ?? null,
      query: input.query.slice(0, 300),
      criteria: criteria as unknown as object,
      strategy: criteria.strategy,
      status: "QUEUED",
      stage: "queued",
    },
  });
  if (input.savedSearchId) {
    await db.savedSearch.updateMany({ where: { id: input.savedSearchId, organizationId: ctx.organizationId }, data: { lastRunAt: new Date(), runCount: { increment: 1 } } });
  }
  await recordUsage(db, ctx.organizationId, "SEARCHES", 1);
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "search.started", entityType: "SearchRun", entityId: run.id, meta: { query: input.query, platform: input.platform, limit: input.limit } });
  return { run, criteria };
}

let testProviders: DiscoveryProvider[] | undefined;

/** Test hook: force the discovery providers used by executeSearchRun. */
export function setDiscoveryProvidersForTests(providers: DiscoveryProvider[] | undefined): void {
  testProviders = providers;
}

export interface ExecuteSearchOptions {
  /** Inject providers (tests / custom); defaults to the organization's configured Apify providers. */
  providers?: DiscoveryProvider[];
  signal?: AbortSignal;
}

export interface ExecuteSearchResult {
  run: SearchRun;
  persisted: PersistBatchResult;
  warnings: string[];
}

async function persistProviderRun(db: DbClient, organizationId: string, searchRunId: string, meta: ProviderRunMeta): Promise<string> {
  const row = await db.providerRun.create({
    data: {
      organizationId,
      searchRunId,
      purpose: meta.purpose,
      provider: meta.provider,
      actorId: meta.actorId,
      adapter: meta.adapter,
      externalRunId: meta.externalRunId ?? null,
      datasetId: meta.datasetId ?? null,
      status: meta.status,
      input: meta.input as object,
      itemCount: meta.itemCount,
      costUsd: meta.costUsd ?? null,
      error: meta.error ?? null,
      startedAt: meta.startedAt,
      finishedAt: meta.finishedAt,
    },
  });
  return row.id;
}

/**
 * Execute a queued SearchRun end-to-end (this is the DISCOVERY_JOB body):
 * providers -> normalize -> dedupe -> score -> persist -> mark completed.
 * Enrichment is *not* run here; the caller enqueues ENRICHMENT_JOBs from the returned lists.
 */
export async function executeSearchRun(db: DbClient, searchRunId: string, options: ExecuteSearchOptions = {}): Promise<ExecuteSearchResult> {
  const run = await db.searchRun.findUnique({ where: { id: searchRunId } });
  if (!run) throw new NotFoundError("SearchRun");
  const criteria = run.criteria as unknown as SearchCriteria;
  const warnings: string[] = [];
  await db.searchRun.update({ where: { id: run.id }, data: { status: "RUNNING", stage: "discovering", startedAt: run.startedAt ?? new Date(), error: null } });

  let providers = options.providers ?? testProviders;
  if (!providers) {
    const resolved = await resolveProviders(db, run.organizationId);
    providers = resolved.discovery;
    warnings.push(...resolved.warnings);
  }
  const providerRunIds = new Map<string, string>();
  const orchestrator = new DiscoveryOrchestrator(providers);
  try {
    const output = await orchestrator.run(criteria, {
      organizationId: run.organizationId,
      searchRunId: run.id,
      signal: options.signal,
      onProviderRun: async (meta) => {
        const id = await persistProviderRun(db, run.organizationId, run.id, meta);
        if (meta.externalRunId) providerRunIds.set(meta.externalRunId, id);
      },
      onProgress: async (stage, detail) => {
        await db.searchRun.update({ where: { id: run.id }, data: { stage: `${stage}${detail?.provider ? `:${String(detail.provider)}` : ""}`.slice(0, 40) } }).catch(() => undefined);
      },
    });
    warnings.push(...output.warnings);
    const limited = output.leads.slice(0, Math.max(criteria.limit, 1) * criteria.platforms.length);
    const persisted = await persistDiscoveredLeads(db, { organizationId: run.organizationId, searchRunId: run.id, leads: limited }, providerRunIds);
    if (persisted.failed > 0) warnings.push(`${persisted.failed} of ${limited.length} leads could not be saved because of a database error: ${persisted.errors.join(" | ")}. The CNEX AI team can see the details in the server log.`);
    const failedOnly = providers.length > 0 && output.runs.length > 0 && output.runs.every((r) => r.status !== "SUCCEEDED");
    const updated = await db.searchRun.update({
      where: { id: run.id },
      data: {
        status: failedOnly ? "FAILED" : criteria.enrich && (persisted.needsProfileEnrichment.length || persisted.needsWebsiteEnrichment.length) ? "ENRICHING" : "COMPLETED",
        stage: failedOnly ? "failed" : "persisted",
        totalRaw: output.totals.raw,
        totalNormalized: output.totals.normalized,
        totalDeduped: output.totals.deduped,
        totalNew: persisted.created,
        providerSummary: { warnings, runs: output.runs.map((r) => ({ actorId: r.actorId, adapter: r.adapter, status: r.status, items: r.itemCount, costUsd: r.costUsd ?? null, error: r.error ?? null })) } as object,
        error: failedOnly ? warnings.join("\n").slice(0, 5000) || "All providers failed" : null,
        completedAt: failedOnly ? new Date() : criteria.enrich && (persisted.needsProfileEnrichment.length || persisted.needsWebsiteEnrichment.length) ? null : new Date(),
      },
    });
    await recordUsage(db, run.organizationId, "LEADS_DISCOVERED", persisted.created);
    await writeAudit(db, { organizationId: run.organizationId, userId: run.userId, actorType: "SYSTEM", action: "search.completed", entityType: "SearchRun", entityId: run.id, meta: { created: persisted.created, matched: persisted.matched, raw: output.totals.raw } });
    log.info("search run persisted", { searchRunId: run.id, created: persisted.created, matched: persisted.matched });
    return { run: updated, persisted, warnings };
  } catch (err) {
    const message = errorMessage(err);
    await db.searchRun.update({ where: { id: run.id }, data: { status: "FAILED", stage: "failed", error: message.slice(0, 5000), completedAt: new Date() } });
    log.error("search run failed", { searchRunId: run.id, error: message });
    throw err;
  }
}

/** Mark a run completed once enrichment finished (called by the enrichment job). */
export async function finalizeSearchRun(db: DbClient, searchRunId: string, enrichedCount: number): Promise<void> {
  await db.searchRun.updateMany({
    where: { id: searchRunId, status: "ENRICHING" },
    data: { status: "COMPLETED", stage: "completed", totalEnriched: { increment: enrichedCount }, completedAt: new Date() },
  });
}

export async function getSearchRun(db: DbClient, ctx: RequestContext, id: string): Promise<SearchRun> {
  const run = await db.searchRun.findFirst({ where: { id, organizationId: ctx.organizationId } });
  if (!run) throw new NotFoundError("Search");
  return run;
}

export async function listSearchRuns(db: DbClient, ctx: RequestContext, take = 20): Promise<SearchRun[]> {
  return db.searchRun.findMany({ where: { organizationId: ctx.organizationId }, orderBy: { createdAt: "desc" }, take });
}

export async function cancelSearchRun(db: DbClient, ctx: RequestContext, id: string): Promise<void> {
  await db.searchRun.updateMany({ where: { id, organizationId: ctx.organizationId, status: { in: ["QUEUED", "RUNNING", "ENRICHING"] } }, data: { status: "CANCELLED", stage: "cancelled", completedAt: new Date() } });
}
