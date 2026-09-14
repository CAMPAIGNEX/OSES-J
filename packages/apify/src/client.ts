import { createLogger, ProviderError, sleep, type ErrorClass } from "@oses/shared";

/**
 * Minimal Apify REST API v2 client.
 *
 * Only the handful of endpoints OSES J needs are wrapped here. Everything above this layer
 * (discovery, enrichment, messaging providers) speaks in terms of "run an Actor with this
 * input and give me the dataset items"; nothing else in the system imports Apify specifics.
 */

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMING-OUT"
  | "TIMED-OUT"
  | "ABORTING"
  | "ABORTED";

export interface ApifyRun {
  id: string;
  actId: string;
  status: ApifyRunStatus;
  startedAt?: string;
  finishedAt?: string;
  defaultDatasetId: string;
  defaultKeyValueStoreId?: string;
  usageTotalUsd?: number;
  statusMessage?: string;
  exitCode?: number;
  buildNumber?: string;
  meta?: Record<string, unknown>;
}

export interface ApifyActorInfo {
  id: string;
  name: string;
  username: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
  isDeprecated?: boolean;
}

export interface StartRunOptions {
  /** Max run duration in seconds enforced by Apify. */
  timeoutSecs?: number;
  memoryMbytes?: number;
  /** Optional build tag/number. */
  build?: string;
  /** Cost cap in USD (Apify "maxTotalChargeUsd" for pay-per-event actors). */
  maxTotalChargeUsd?: number;
}

export interface WaitOptions {
  timeoutMs?: number;
  pollIntervalMs?: number;
  onPoll?: (run: ApifyRun) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface DatasetItemsOptions {
  offset?: number;
  limit?: number;
  clean?: boolean;
  fields?: string[];
}

export interface ApifyClientOptions {
  token: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const log = createLogger("apify");

const TERMINAL_STATUSES = new Set<ApifyRunStatus>(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"]);

export function isTerminalRunStatus(status: ApifyRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

/** Apify accepts `username/name` in most places but URLs need `username~name`. */
export function normalizeActorId(actorId: string): string {
  return actorId.trim().replace("/", "~");
}

function classifyHttp(status: number): ErrorClass {
  if (status === 401 || status === 403) return "AUTHENTICATION";
  if (status === 429) return "RATE_LIMIT";
  if (status === 404) return "PERMANENT";
  if (status >= 500) return "TEMPORARY";
  return "PERMANENT";
}

export class ApifyClient {
  private readonly token: string;
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ApifyClientOptions) {
    if (!options.token) throw new ProviderError("apify", "Apify API token is not configured", { code: "APIFY_NOT_CONFIGURED", status: 503, errorClass: "USER_ACTION_REQUIRED" });
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? "https://api.apify.com/v2").replace(/\/$/, "");
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));
    }
    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      res = await this.fetchImpl(url.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      throw new ProviderError("apify", `Apify request failed: ${(err as Error).message}`, { errorClass: "TEMPORARY", cause: err });
    }
    clearTimeout(timer);
    if (!res.ok) {
      let detail = "";
      try {
        const json = (await res.json()) as { error?: { type?: string; message?: string } };
        detail = json.error?.message ?? json.error?.type ?? "";
      } catch {
        detail = await res.text().catch(() => "");
      }
      throw new ProviderError("apify", `Apify API ${method} ${path} returned ${res.status}${detail ? `: ${detail}` : ""}`, {
        status: 502,
        errorClass: classifyHttp(res.status),
        details: { httpStatus: res.status, detail },
      });
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  /** Validate the token and return the account username. */
  async getMe(): Promise<{ id: string; username: string; plan?: string }> {
    const json = await this.request<{ data: { id: string; username: string; plan?: { id?: string } } }>("GET", "/users/me");
    return { id: json.data.id, username: json.data.username, plan: json.data.plan?.id };
  }

  async getActor(actorId: string): Promise<ApifyActorInfo> {
    const json = await this.request<{ data: ApifyActorInfo }>("GET", `/acts/${encodeURIComponent(normalizeActorId(actorId))}`);
    return json.data;
  }

  async startRun(actorId: string, input: unknown, options: StartRunOptions = {}): Promise<ApifyRun> {
    const json = await this.request<{ data: ApifyRun }>("POST", `/acts/${encodeURIComponent(normalizeActorId(actorId))}/runs`, input, {
      timeout: options.timeoutSecs,
      memory: options.memoryMbytes,
      build: options.build,
      maxTotalChargeUsd: options.maxTotalChargeUsd,
    });
    log.info("Actor run started", { actorId, runId: json.data.id, status: json.data.status });
    return json.data;
  }

  async getRun(runId: string): Promise<ApifyRun> {
    const json = await this.request<{ data: ApifyRun }>("GET", `/actor-runs/${encodeURIComponent(runId)}`);
    return json.data;
  }

  async abortRun(runId: string): Promise<ApifyRun> {
    const json = await this.request<{ data: ApifyRun }>("POST", `/actor-runs/${encodeURIComponent(runId)}/abort`);
    return json.data;
  }

  /** Poll until the run reaches a terminal status or the timeout elapses (the run is then aborted). */
  async waitForRun(runId: string, options: WaitOptions = {}): Promise<ApifyRun> {
    const timeoutMs = options.timeoutMs ?? 10 * 60_000;
    const pollIntervalMs = options.pollIntervalMs ?? 5_000;
    const started = Date.now();
    let run = await this.getRun(runId);
    while (!isTerminalRunStatus(run.status)) {
      if (options.signal?.aborted) {
        await this.abortRun(runId).catch(() => undefined);
        throw new ProviderError("apify", "Actor run cancelled", { errorClass: "PERMANENT" });
      }
      if (Date.now() - started > timeoutMs) {
        await this.abortRun(runId).catch(() => undefined);
        throw new ProviderError("apify", `Actor run ${runId} exceeded ${Math.round(timeoutMs / 1000)}s and was aborted`, { errorClass: "TEMPORARY", details: { runId } });
      }
      await sleep(pollIntervalMs);
      run = await this.getRun(runId);
      if (options.onPoll) await options.onPoll(run);
    }
    return run;
  }

  async getDatasetItems<T = Record<string, unknown>>(datasetId: string, options: DatasetItemsOptions = {}): Promise<T[]> {
    const json = await this.request<T[]>("GET", `/datasets/${encodeURIComponent(datasetId)}/items`, undefined, {
      format: "json",
      clean: options.clean ?? true,
      offset: options.offset,
      limit: options.limit,
      fields: options.fields?.join(","),
    });
    return Array.isArray(json) ? json : [];
  }

  /** Fetch a whole dataset in pages (bounded by maxItems). */
  async getAllDatasetItems<T = Record<string, unknown>>(datasetId: string, maxItems = 5000, pageSize = 500): Promise<T[]> {
    const out: T[] = [];
    let offset = 0;
    while (out.length < maxItems) {
      const limit = Math.min(pageSize, maxItems - out.length);
      const page = await this.getDatasetItems<T>(datasetId, { offset, limit });
      out.push(...page);
      if (page.length < limit) break;
      offset += page.length;
    }
    return out;
  }

  /** Convenience: start, wait, and collect items. */
  async runAndCollect<T = Record<string, unknown>>(
    actorId: string,
    input: unknown,
    options: StartRunOptions & WaitOptions & { maxItems?: number } = {},
  ): Promise<{ run: ApifyRun; items: T[] }> {
    const started = await this.startRun(actorId, input, options);
    const run = await this.waitForRun(started.id, options);
    assertRunSucceeded(run);
    const items = await this.getAllDatasetItems<T>(run.defaultDatasetId, options.maxItems ?? 5000);
    return { run, items };
  }
}

export function assertRunSucceeded(run: ApifyRun): void {
  if (run.status === "SUCCEEDED") return;
  const errorClass: ErrorClass = run.status === "TIMED-OUT" ? "TEMPORARY" : "PERMANENT";
  throw new ProviderError("apify", `Actor run ${run.id} finished with status ${run.status}${run.statusMessage ? `: ${run.statusMessage}` : ""}`, {
    errorClass,
    details: { runId: run.id, status: run.status, statusMessage: run.statusMessage, exitCode: run.exitCode },
  });
}
