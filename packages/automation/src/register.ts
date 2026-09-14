import type { DbClient } from "@oses/database";
import { createLogger, errorMessage, getEnv } from "@oses/shared";
import { hostname } from "node:os";
import { handleAiFirstMessageJob, handleAiReplyJob, handleFollowUpJob } from "./handlers/ai";
import { handleDiscoveryJob, handleEnrichmentJob } from "./handlers/discovery";
import { handleCampaignStepJob, handleCompetitorAnalysisJob, handleDocumentProcessingJob, handleExportJob, handleTrashCleanupJob, handleTrendAnalysisJob } from "./handlers/maintenance";
import { handleMessageJob, handleScheduledMessageJob } from "./handlers/messages";
import { getJobQueue, type JobQueue } from "./queue";
import { JobRunner, type RunOnceSummary } from "./runner";
import { runSchedulerTick } from "./scheduler";

const log = createLogger("automation");

/** Build a runner with every job handler registered. */
export function createRunner(db: DbClient, queue: JobQueue = getJobQueue(db), workerId = `${hostname()}:${process.pid}`): JobRunner {
  return new JobRunner(db, queue, workerId)
    .register("DISCOVERY_JOB", handleDiscoveryJob)
    .register("ENRICHMENT_JOB", handleEnrichmentJob)
    .register("MESSAGE_JOB", handleMessageJob)
    .register("SCHEDULED_MESSAGE_JOB", handleScheduledMessageJob)
    .register("AI_REPLY_JOB", handleAiReplyJob)
    .register("AI_FIRST_MESSAGE_JOB", handleAiFirstMessageJob)
    .register("FOLLOWUP_JOB", handleFollowUpJob)
    .register("CAMPAIGN_STEP_JOB", handleCampaignStepJob)
    .register("EXPORT_JOB", handleExportJob)
    .register("DOCUMENT_PROCESSING_JOB", handleDocumentProcessingJob)
    .register("TRASH_CLEANUP_JOB", handleTrashCleanupJob)
    .register("COMPETITOR_ANALYSIS_JOB", handleCompetitorAnalysisJob)
    .register("TREND_ANALYSIS_JOB", handleTrendAnalysisJob);
}

let inlineRunning = false;
let inlineRequested = false;

/**
 * Inline processing for JOB_RUNNER_MODE=inline (dev / shared hosting): process queued jobs in the web
 * process right after they are enqueued. Guarded so concurrent requests share one runner loop.
 */
export async function processJobsInline(db: DbClient, options: { timeBudgetMs?: number; maxJobs?: number; scheduler?: boolean } = {}): Promise<RunOnceSummary | null> {
  if (getEnv().JOB_RUNNER_MODE !== "inline") return null;
  if (inlineRunning) {
    inlineRequested = true;
    return null;
  }
  inlineRunning = true;
  try {
    const queue = getJobQueue(db);
    const runner = createRunner(db, queue, `inline:${process.pid}`);
    let summary: RunOnceSummary | null = null;
    do {
      inlineRequested = false;
      if (options.scheduler !== false) await runSchedulerTick(db, queue).catch((err) => log.warn("scheduler tick failed", { error: errorMessage(err) }));
      summary = await runner.runOnce({ timeBudgetMs: options.timeBudgetMs ?? 120_000, maxJobs: options.maxJobs ?? 10 });
    } while (inlineRequested);
    return summary;
  } catch (err) {
    log.error("inline job processing failed", { error: errorMessage(err) });
    return null;
  } finally {
    inlineRunning = false;
  }
}

/** Cron-mode entry point: one scheduler tick + a bounded batch of jobs. */
export async function processJobsForCron(db: DbClient, options: { timeBudgetMs?: number; maxJobs?: number } = {}): Promise<RunOnceSummary> {
  const queue = getJobQueue(db);
  await runSchedulerTick(db, queue);
  const runner = createRunner(db, queue, `cron:${process.pid}`);
  return runner.runOnce({ timeBudgetMs: options.timeBudgetMs ?? 55_000, maxJobs: options.maxJobs ?? 25 });
}
