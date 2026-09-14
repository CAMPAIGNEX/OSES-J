import type { DbClient } from "@oses/database";
import { sweepOfflineDevices } from "@oses/messaging";
import { createLogger, errorMessage, formatDateKey } from "@oses/shared";
import type { JobQueue } from "./queue";

const log = createLogger("automation.scheduler");

export interface SchedulerSummary {
  scheduledMessagesQueued: number;
  messageJobsQueued: number;
  campaignsTicked: number;
  trashCleanupQueued: boolean;
  staleSearchRunsFailed: number;
  devicesMarkedOffline: number;
}

/**
 * One scheduler tick. Idempotent: everything it enqueues carries a dedupe key, so it can run from a
 * cron endpoint, the worker loop, or inline after web requests without creating duplicate work.
 */
export async function runSchedulerTick(db: DbClient, queue: JobQueue): Promise<SchedulerSummary> {
  const summary: SchedulerSummary = { scheduledMessagesQueued: 0, messageJobsQueued: 0, campaignsTicked: 0, trashCleanupQueued: false, staleSearchRunsFailed: 0, devicesMarkedOffline: 0 };
  const now = new Date();

  // 1) Scheduled messages that are due -> SCHEDULED_MESSAGE_JOB
  const due = await db.scheduledMessage.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: now } }, take: 200, orderBy: { scheduledAt: "asc" } });
  for (const sm of due) {
    try {
      const job = await queue.enqueue({ type: "SCHEDULED_MESSAGE_JOB", organizationId: sm.organizationId, payload: { scheduledMessageId: sm.id }, priority: 3, dedupeKey: `scheduled:${sm.id}`, entityType: "ScheduledMessage", entityId: sm.id });
      await db.scheduledMessage.update({ where: { id: sm.id }, data: { status: "QUEUED", jobId: job.id } });
      summary.scheduledMessagesQueued++;
    } catch (err) {
      log.error("failed to queue scheduled message", { id: sm.id, error: errorMessage(err) });
    }
  }

  // 2) Server-driven message jobs (Meta / Apify) that have no automation job yet
  const pendingJobs = await db.messageJob.findMany({ where: { provider: { in: ["META", "APIFY"] }, status: "QUEUED", scheduledAt: { lte: now } }, take: 100, orderBy: { scheduledAt: "asc" } });
  for (const mj of pendingJobs) {
    await queue.enqueue({ type: "MESSAGE_JOB", organizationId: mj.organizationId, payload: { messageJobId: mj.id }, priority: 3, dedupeKey: `message-job:${mj.id}:${mj.attempts + 1}`, entityType: "MessageJob", entityId: mj.id });
    summary.messageJobsQueued++;
  }

  // 3) Running campaigns tick (at most every 10 minutes per campaign) and scheduled campaigns that should start
  await db.campaign.updateMany({ where: { status: "SCHEDULED", startAt: { lte: now }, deletedAt: null }, data: { status: "RUNNING", startedAt: now } });
  const bucket = Math.floor(now.getTime() / 600_000);
  const running = await db.campaign.findMany({ where: { status: "RUNNING", deletedAt: null }, select: { id: true, organizationId: true } });
  for (const c of running) {
    await queue.enqueue({ type: "CAMPAIGN_STEP_JOB", organizationId: c.organizationId, payload: { campaignId: c.id }, priority: 6, dedupeKey: `campaign-step:${c.id}:${bucket}`, entityType: "Campaign", entityId: c.id });
    summary.campaignsTicked++;
  }

  // 4) Daily trash cleanup
  const dayKey = formatDateKey(now);
  const cleanup = await queue.enqueue({ type: "TRASH_CLEANUP_JOB", payload: { day: dayKey }, priority: 9, dedupeKey: `trash-cleanup:${dayKey}` });
  summary.trashCleanupQueued = cleanup.status === "QUEUED";

  // 5) Search runs stuck in RUNNING/ENRICHING for over an hour without a live job
  const stale = await db.searchRun.updateMany({ where: { status: { in: ["RUNNING", "ENRICHING"] }, updatedAt: { lt: new Date(now.getTime() - 3_600_000) } }, data: { status: "FAILED", stage: "timed_out", error: "Search did not finish within an hour", completedAt: now } });
  summary.staleSearchRunsFailed = stale.count;

  // 6) Extension devices that stopped sending heartbeats
  summary.devicesMarkedOffline = await sweepOfflineDevices(db);

  if (summary.scheduledMessagesQueued || summary.messageJobsQueued || summary.staleSearchRunsFailed) log.info("scheduler tick", { ...summary });
  return summary;
}
