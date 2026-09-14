import type { AutomationJob, DbClient, JobType } from "@oses/database";
import { classifyError, createLogger, errorMessage, RETRY_BACKOFF_MS, sleep, type ErrorClass } from "@oses/shared";
import type { JobQueue } from "./queue";

const log = createLogger("automation.runner");

export interface JobContext {
  db: DbClient;
  queue: JobQueue;
  job: AutomationJob;
  organizationId: string | null;
  payload: Record<string, unknown>;
  log: ReturnType<typeof createLogger>;
}

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown> | void>;

export interface RunOnceOptions {
  maxJobs?: number;
  timeBudgetMs?: number;
  types?: JobType[];
}

export interface RunOnceSummary {
  processed: number;
  completed: number;
  failed: number;
  retried: number;
  durationMs: number;
}

/** Exponential backoff schedule: 30s, 2m, 10m, 30m (capped). */
export function retryDelayMs(attempt: number, errorClass: ErrorClass): number | null {
  if (errorClass === "PERMANENT" || errorClass === "AUTHENTICATION" || errorClass === "USER_ACTION_REQUIRED" || errorClass === "TARGET_UNAVAILABLE") return null;
  const base = RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)] ?? 1_800_000;
  return errorClass === "RATE_LIMIT" ? Math.max(base, 600_000) : base;
}

/**
 * Executes queued jobs through registered handlers.
 *
 * The same runner powers all three deployment modes:
 *  - inline: web process runs `runOnce` right after enqueuing (shared hosting / dev)
 *  - cron:   POST /api/internal/jobs/tick calls `runOnce` with a time budget
 *  - worker: standalone process calls `runForever`
 */
export class JobRunner {
  private readonly handlers = new Map<JobType, JobHandler>();
  private stopping = false;

  constructor(
    private readonly db: DbClient,
    private readonly queue: JobQueue,
    private readonly workerId: string,
  ) {}

  register(type: JobType, handler: JobHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  registeredTypes(): JobType[] {
    return [...this.handlers.keys()];
  }

  async runJob(job: AutomationJob): Promise<"completed" | "failed" | "retried"> {
    const handler = this.handlers.get(job.type);
    const jobLog = log.child({ jobId: job.id, type: job.type, organizationId: job.organizationId ?? undefined, attempt: job.attempts });
    if (!handler) {
      await this.queue.fail(job.id, { error: `No handler registered for ${job.type}`, errorClass: "PERMANENT" });
      jobLog.error("no handler registered");
      return "failed";
    }
    const started = Date.now();
    try {
      const result = await handler({ db: this.db, queue: this.queue, job, organizationId: job.organizationId, payload: (job.payload as Record<string, unknown>) ?? {}, log: jobLog });
      await this.queue.complete(job.id, result ?? null);
      jobLog.info("job completed", { durationMs: Date.now() - started });
      return "completed";
    } catch (err) {
      const errorClass = classifyError(err);
      const message = errorMessage(err);
      const delay = job.attempts < job.maxAttempts ? retryDelayMs(job.attempts, errorClass) : null;
      if (delay != null) {
        await this.queue.fail(job.id, { error: message, errorClass, retryAt: new Date(Date.now() + delay) });
        jobLog.warn("job failed; retry scheduled", { errorClass, retryInMs: delay, error: message });
        return "retried";
      }
      await this.queue.fail(job.id, { error: message, errorClass });
      jobLog.error("job failed permanently", { errorClass, error: message });
      return "failed";
    }
  }

  /** Process jobs until none are runnable, the job cap is hit, or the time budget is spent. */
  async runOnce(options: RunOnceOptions = {}): Promise<RunOnceSummary> {
    const started = Date.now();
    const maxJobs = options.maxJobs ?? 20;
    const timeBudgetMs = options.timeBudgetMs ?? 55_000;
    const summary: RunOnceSummary = { processed: 0, completed: 0, failed: 0, retried: 0, durationMs: 0 };
    await this.queue.releaseExpiredLocks().catch(() => 0);
    while (summary.processed < maxJobs && Date.now() - started < timeBudgetMs && !this.stopping) {
      const job = await this.queue.claim(this.workerId, { types: options.types ?? this.registeredTypes() });
      if (!job) break;
      summary.processed++;
      const outcome = await this.runJob(job);
      if (outcome === "completed") summary.completed++;
      else if (outcome === "failed") summary.failed++;
      else summary.retried++;
    }
    summary.durationMs = Date.now() - started;
    return summary;
  }

  /** Long-running loop for the standalone worker. */
  async runForever(options: { pollIntervalMs?: number; concurrency?: number; onIdle?: () => Promise<void> | void } = {}): Promise<void> {
    const pollIntervalMs = options.pollIntervalMs ?? 3000;
    const concurrency = Math.max(1, options.concurrency ?? 2);
    log.info("worker started", { workerId: this.workerId, concurrency, types: this.registeredTypes() });
    const lanes = Array.from({ length: concurrency }, async (_, lane) => {
      while (!this.stopping) {
        const job = await this.queue.claim(`${this.workerId}#${lane}`, { types: this.registeredTypes() }).catch((err) => {
          log.error("claim failed", { error: errorMessage(err) });
          return null;
        });
        if (!job) {
          await sleep(pollIntervalMs);
          continue;
        }
        await this.runJob(job);
      }
    });
    const housekeeping = (async () => {
      while (!this.stopping) {
        await this.queue.releaseExpiredLocks().catch(() => 0);
        await options.onIdle?.();
        await sleep(Math.max(pollIntervalMs * 5, 15_000));
      }
    })();
    await Promise.all([...lanes, housekeeping]);
  }

  stop(): void {
    this.stopping = true;
  }
}
