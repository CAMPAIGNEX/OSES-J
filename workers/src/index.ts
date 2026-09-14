/**
 * OSES J standalone worker.
 *
 * Runs the job runner and the scheduler loop outside the web process (VPS / container deployment).
 * Start with `pnpm worker` (JOB_RUNNER_MODE=worker keeps the web app from processing jobs inline).
 */
import path from "node:path";
import { config as loadDotenv } from "dotenv";
loadDotenv({ path: path.resolve(import.meta.dirname, "../../.env") });

import { createRunner, getJobQueue, runSchedulerTick } from "@oses/automation";
import { disconnectDb, getDb } from "@oses/database";
import { createLogger, errorMessage, getEnv } from "@oses/shared";

const log = createLogger("worker");

async function main(): Promise<void> {
  const env = getEnv();
  const db = getDb();
  const queue = getJobQueue(db);
  const runner = createRunner(db, queue);
  const shutdown = async (signal: string) => {
    log.info("shutting down", { signal });
    runner.stop();
    setTimeout(async () => {
      await disconnectDb();
      process.exit(0);
    }, 2000);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  log.info("worker booting", { mode: env.JOB_RUNNER_MODE, queue: queue.driver, concurrency: env.WORKER_CONCURRENCY });
  await runner.runForever({
    pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
    concurrency: env.WORKER_CONCURRENCY,
    onIdle: async () => {
      try {
        await runSchedulerTick(db, queue);
      } catch (err) {
        log.error("scheduler tick failed", { error: errorMessage(err) });
      }
    },
  });
}

main().catch(async (err) => {
  log.error("worker crashed", { error: errorMessage(err) });
  await disconnectDb();
  process.exit(1);
});
