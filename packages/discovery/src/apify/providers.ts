import { assertRunSucceeded, type ApifyClient, type ApifyRun } from "@oses/apify";
import { createLogger, errorMessage, type Platform } from "@oses/shared";
import type {
  ContentBatch,
  ContentCriteria,
  ContentProvider,
  DiscoveryBatch,
  DiscoveryContext,
  DiscoveryProvider,
  DiscoverySource,
  ProfileProvider,
  ProviderRunMeta,
  SearchCriteria,
} from "../types";
import type { ActorAdapter, AdapterSettings, ProfileTarget } from "./adapters";

const log = createLogger("discovery.apify");

export interface ApifyProviderConfig {
  client: ApifyClient;
  actorId: string;
  adapter: ActorAdapter;
  settings?: AdapterSettings;
  timeoutSec?: number;
  costLimitUsd?: number | null;
  priority?: number;
  /** Poll interval while waiting for the Actor run. */
  pollIntervalMs?: number;
}

type Item = Record<string, unknown>;

interface RunOutcome {
  items: Item[];
  meta: ProviderRunMeta;
  source: DiscoverySource;
}

async function executeActor(
  cfg: ApifyProviderConfig,
  purpose: ProviderRunMeta["purpose"],
  input: unknown,
  ctx: DiscoveryContext,
): Promise<RunOutcome> {
  const startedAt = new Date();
  const maxItems = cfg.settings?.maxItems ?? 2000;
  let run: ApifyRun | undefined;
  try {
    await ctx.onProgress?.("provider:start", { actorId: cfg.actorId, purpose });
    run = await cfg.client.startRun(cfg.actorId, input, {
      timeoutSecs: cfg.timeoutSec ?? 600,
      ...(cfg.costLimitUsd ? { maxTotalChargeUsd: cfg.costLimitUsd } : {}),
    });
    run = await cfg.client.waitForRun(run.id, {
      timeoutMs: (cfg.timeoutSec ?? 600) * 1000 + 30_000,
      pollIntervalMs: cfg.pollIntervalMs ?? 5000,
      signal: ctx.signal,
      onPoll: (r) => ctx.onProgress?.("provider:poll", { runId: r.id, status: r.status }),
    });
    assertRunSucceeded(run);
    const items = await cfg.client.getAllDatasetItems<Item>(run.defaultDatasetId, maxItems);
    const meta: ProviderRunMeta = {
      provider: "apify",
      actorId: cfg.actorId,
      adapter: cfg.adapter.key,
      purpose,
      externalRunId: run.id,
      datasetId: run.defaultDatasetId,
      status: "SUCCEEDED",
      input,
      itemCount: items.length,
      costUsd: run.usageTotalUsd ?? null,
      startedAt,
      finishedAt: new Date(),
    };
    await ctx.onProviderRun?.(meta);
    log.info("Actor run finished", { actorId: cfg.actorId, runId: run.id, items: items.length, purpose });
    return {
      items,
      meta,
      source: { provider: "apify", actorId: cfg.actorId, adapter: cfg.adapter.key, externalRunId: run.id, fetchedAt: meta.finishedAt },
    };
  } catch (err) {
    const meta: ProviderRunMeta = {
      provider: "apify",
      actorId: cfg.actorId,
      adapter: cfg.adapter.key,
      purpose,
      externalRunId: run?.id ?? null,
      datasetId: run?.defaultDatasetId ?? null,
      status: run?.status === "TIMED-OUT" ? "TIMED_OUT" : run?.status === "ABORTED" ? "ABORTED" : "FAILED",
      input,
      itemCount: 0,
      costUsd: run?.usageTotalUsd ?? null,
      error: errorMessage(err),
      startedAt,
      finishedAt: new Date(),
    };
    await ctx.onProviderRun?.(meta);
    log.warn("Actor run failed", { actorId: cfg.actorId, runId: run?.id, error: errorMessage(err), purpose });
    throw err;
  }
}

/** Discovery through a configured Apify Actor + adapter. */
export class ApifyDiscoveryProvider implements DiscoveryProvider {
  readonly key: string;
  readonly platform: Platform;
  readonly strategy: SearchCriteria["strategy"];
  readonly priority: number;

  constructor(private readonly cfg: ApifyProviderConfig, strategy: SearchCriteria["strategy"]) {
    this.key = `apify:${cfg.adapter.key}:${cfg.actorId}`;
    this.platform = cfg.adapter.platform;
    this.strategy = strategy;
    this.priority = cfg.priority ?? 1;
  }

  supports(criteria: SearchCriteria): boolean {
    if (!criteria.platforms.includes(this.platform)) return false;
    if (!this.cfg.adapter.buildDiscoveryInput) return false;
    if (this.strategy === "hashtag" && criteria.hashtags.length === 0) return false;
    return criteria.strategy === "auto" || criteria.strategy === this.strategy;
  }

  async search(criteria: SearchCriteria, ctx: DiscoveryContext): Promise<DiscoveryBatch> {
    const input = this.cfg.adapter.buildDiscoveryInput!(criteria, this.cfg.settings ?? {});
    try {
      const outcome = await executeActor(this.cfg, "DISCOVERY", input, ctx);
      const results = this.cfg.adapter.normalizeProfiles(outcome.items, outcome.source).filter((r) => r.platform === this.platform);
      const warnings: string[] = [];
      if (outcome.items.length > 0 && results.length === 0) {
        warnings.push(`Actor ${this.cfg.actorId} returned ${outcome.items.length} items but none could be normalized with adapter "${this.cfg.adapter.key}". Check the Actor output schema.`);
      }
      return { results, runs: [outcome.meta], warnings };
    } catch (err) {
      return { results: [], runs: [], warnings: [`${this.cfg.actorId}: ${errorMessage(err)}`] };
    }
  }
}

/** Profile enrichment through a configured Apify Actor + adapter. */
export class ApifyProfileProvider implements ProfileProvider {
  readonly key: string;
  readonly platform: Platform;

  constructor(private readonly cfg: ApifyProviderConfig) {
    this.key = `apify:${cfg.adapter.key}:${cfg.actorId}`;
    this.platform = cfg.adapter.platform;
  }

  async fetchProfiles(targets: ProfileTarget[], ctx: DiscoveryContext): Promise<DiscoveryBatch> {
    if (!targets.length || !this.cfg.adapter.buildProfileInput) return { results: [], runs: [], warnings: [] };
    const input = this.cfg.adapter.buildProfileInput(targets, this.cfg.settings ?? {});
    try {
      const outcome = await executeActor(this.cfg, "PROFILE_ENRICHMENT", input, ctx);
      const results = this.cfg.adapter.normalizeProfiles(outcome.items, outcome.source).filter((r) => r.platform === this.platform);
      return { results, runs: [outcome.meta], warnings: [] };
    } catch (err) {
      return { results: [], runs: [], warnings: [`${this.cfg.actorId}: ${errorMessage(err)}`] };
    }
  }
}

/** Public content collection (posts) for competitor/trend analysis. */
export class ApifyContentProvider implements ContentProvider {
  readonly key: string;
  readonly platform: Platform;

  constructor(private readonly cfg: ApifyProviderConfig) {
    this.key = `apify:${cfg.adapter.key}:${cfg.actorId}`;
    this.platform = cfg.adapter.platform;
  }

  async fetchContent(criteria: ContentCriteria, ctx: DiscoveryContext): Promise<ContentBatch> {
    if (!this.cfg.adapter.buildContentInput || !this.cfg.adapter.normalizeContent) return { results: [], runs: [], warnings: [`Adapter ${this.cfg.adapter.key} does not support content collection`] };
    const input = this.cfg.adapter.buildContentInput(criteria, this.cfg.settings ?? {});
    try {
      const outcome = await executeActor(this.cfg, "CONTENT", input, ctx);
      let results = this.cfg.adapter.normalizeContent(outcome.items, outcome.source);
      if (criteria.dateFrom) results = results.filter((r) => !r.postedAt || r.postedAt >= criteria.dateFrom!);
      if (criteria.dateTo) results = results.filter((r) => !r.postedAt || r.postedAt <= criteria.dateTo!);
      return { results, runs: [outcome.meta], warnings: [] };
    } catch (err) {
      return { results: [], runs: [], warnings: [`${this.cfg.actorId}: ${errorMessage(err)}`] };
    }
  }
}
