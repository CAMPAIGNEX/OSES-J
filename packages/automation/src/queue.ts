import type { AutomationJob, DbClient, JobStatus, JobType, Prisma } from "@oses/database";
import { ConfigurationError, getEnv, type ErrorClass } from "@oses/shared";

/**
 * Queue abstraction.
 *
 * The MySQL driver keeps OSES-J deployable on shared hosting (no Redis). A Redis/BullMQ driver can be
 * added behind the same interface for VPS deployments; the rest of the system only sees `JobQueue`.
 */

export interface EnqueueInput {
  type: JobType;
  organizationId?: string | null;
  payload: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date;
  maxAttempts?: number;
  /** Prevents duplicate jobs (unique). When a job with the key already exists it is returned instead. */
  dedupeKey?: string | null;
  parentJobId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

export interface JobQueue {
  readonly driver: string;
  enqueue(input: EnqueueInput): Promise<AutomationJob>;
  /** Claim the next runnable job (atomic). */
  claim(workerId: string, options?: { types?: JobType[]; lockSeconds?: number }): Promise<AutomationJob | null>;
  complete(jobId: string, result?: Record<string, unknown> | null): Promise<void>;
  fail(jobId: string, input: { error: string; errorClass: ErrorClass; retryAt?: Date | null }): Promise<void>;
  cancel(jobId: string): Promise<void>;
  get(jobId: string): Promise<AutomationJob | null>;
  countByStatus(organizationId?: string): Promise<Record<JobStatus, number>>;
  /** Re-queue jobs whose lock expired (worker crashed). */
  releaseExpiredLocks(): Promise<number>;
}

export class MysqlJobQueue implements JobQueue {
  readonly driver = "mysql";
  constructor(private readonly db: DbClient) {}

  async enqueue(input: EnqueueInput): Promise<AutomationJob> {
    if (input.dedupeKey) {
      const existing = await this.db.automationJob.findUnique({ where: { dedupeKey: input.dedupeKey } });
      if (existing && (existing.status === "QUEUED" || existing.status === "RUNNING")) return existing;
      if (existing) {
        // Completed/failed job with the same key: free the key so the new run can be scheduled.
        await this.db.automationJob.update({ where: { id: existing.id }, data: { dedupeKey: `${input.dedupeKey}:${existing.id.slice(-8)}` } });
      }
    }
    return this.db.automationJob.create({
      data: {
        type: input.type,
        organizationId: input.organizationId ?? null,
        payload: input.payload as object,
        priority: input.priority ?? 5,
        scheduledAt: input.scheduledAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? 3,
        dedupeKey: input.dedupeKey ?? null,
        parentJobId: input.parentJobId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
      },
    });
  }

  async claim(workerId: string, options: { types?: JobType[]; lockSeconds?: number } = {}): Promise<AutomationJob | null> {
    const now = new Date();
    const lockExpiresAt = new Date(now.getTime() + (options.lockSeconds ?? 900) * 1000);
    for (let attempt = 0; attempt < 5; attempt++) {
      const where: Prisma.AutomationJobWhereInput = { status: "QUEUED", scheduledAt: { lte: now } };
      if (options.types?.length) where.type = { in: options.types };
      const candidate = await this.db.automationJob.findFirst({ where, orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }, { createdAt: "asc" }] });
      if (!candidate) return null;
      // Conditional update = atomic claim without SKIP LOCKED (works on MariaDB 10.4 and MySQL 5.7+).
      const res = await this.db.automationJob.updateMany({
        where: { id: candidate.id, status: "QUEUED" },
        data: { status: "RUNNING", startedAt: now, lockedAt: now, lockedBy: workerId, lockExpiresAt, attempts: { increment: 1 } },
      });
      if (res.count === 1) return (await this.db.automationJob.findUnique({ where: { id: candidate.id } })) as AutomationJob;
    }
    return null;
  }

  async complete(jobId: string, result?: Record<string, unknown> | null): Promise<void> {
    await this.db.automationJob.update({ where: { id: jobId }, data: { status: "COMPLETED", completedAt: new Date(), result: result ? (result as object) : undefined, lockedBy: null, lockExpiresAt: null, error: null } });
  }

  async fail(jobId: string, input: { error: string; errorClass: ErrorClass; retryAt?: Date | null }): Promise<void> {
    if (input.retryAt) {
      await this.db.automationJob.update({ where: { id: jobId }, data: { status: "QUEUED", scheduledAt: input.retryAt, error: input.error.slice(0, 5000), errorClass: input.errorClass, lockedBy: null, lockExpiresAt: null } });
      return;
    }
    await this.db.automationJob.update({ where: { id: jobId }, data: { status: "FAILED", completedAt: new Date(), error: input.error.slice(0, 5000), errorClass: input.errorClass, lockedBy: null, lockExpiresAt: null } });
  }

  async cancel(jobId: string): Promise<void> {
    await this.db.automationJob.updateMany({ where: { id: jobId, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED", completedAt: new Date(), lockedBy: null, lockExpiresAt: null } });
  }

  async get(jobId: string): Promise<AutomationJob | null> {
    return this.db.automationJob.findUnique({ where: { id: jobId } });
  }

  async countByStatus(organizationId?: string): Promise<Record<JobStatus, number>> {
    const rows = await this.db.automationJob.groupBy({ by: ["status"], where: organizationId ? { organizationId } : undefined, _count: { _all: true } });
    const out: Record<JobStatus, number> = { QUEUED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0 };
    for (const r of rows) out[r.status] = r._count._all;
    return out;
  }

  async releaseExpiredLocks(): Promise<number> {
    const res = await this.db.automationJob.updateMany({ where: { status: "RUNNING", lockExpiresAt: { lt: new Date() } }, data: { status: "QUEUED", lockedBy: null, lockExpiresAt: null, error: "lock expired; re-queued" } });
    return res.count;
  }
}

let cachedQueue: JobQueue | undefined;

/** Queue for the configured driver. Redis is reserved for a future BullMQ driver. */
export function getJobQueue(db: DbClient): JobQueue {
  if (cachedQueue) return cachedQueue;
  const env = getEnv();
  if (env.QUEUE_DRIVER === "redis") {
    throw new ConfigurationError("QUEUE_DRIVER=redis is not available in this build; use QUEUE_DRIVER=mysql (a Redis/BullMQ driver can be added behind the JobQueue interface).");
  }
  cachedQueue = new MysqlJobQueue(db);
  return cachedQueue;
}

export function resetJobQueueCache(): void {
  cachedQueue = undefined;
}
