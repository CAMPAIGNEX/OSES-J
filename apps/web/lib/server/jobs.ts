import "server-only";
import { after } from "next/server";
import { getJobQueue, processJobsInline, type EnqueueInput } from "@oses/automation";
import { db, type AutomationJob } from "@oses/database";
import { createLogger, errorMessage, getEnv } from "@oses/shared";

const log = createLogger("web.jobs");

/**
 * Enqueue a job and, in JOB_RUNNER_MODE=inline, process the queue after the response is sent.
 * In cron/worker modes the job simply waits for the external runner.
 */
export async function enqueueJob(input: EnqueueInput): Promise<AutomationJob> {
  const job = await getJobQueue(db).enqueue(input);
  kickInlineRunner();
  return job;
}

/** Fire-and-forget inline processing (guarded inside processJobsInline against concurrent runs). */
export function kickInlineRunner(): void {
  if (getEnv().JOB_RUNNER_MODE !== "inline") return;
  try {
    after(async () => {
      await processJobsInline(db).catch((err) => log.error("inline processing failed", { error: errorMessage(err) }));
    });
  } catch {
    // `after` is only available inside a request scope; fall back to a detached promise.
    void processJobsInline(db).catch((err) => log.error("inline processing failed", { error: errorMessage(err) }));
  }
}
