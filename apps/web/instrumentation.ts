/**
 * Next.js instrumentation hook (runs once per server process).
 * In JOB_RUNNER_MODE=inline there is no worker or cron, so the web process itself runs the scheduler
 * and queued jobs on an interval while it is up (dev server and shared hosting).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv, checkEnv, createLogger, errorMessage } = await import("@oses/shared");
  const config = checkEnv();
  if (!config.ok) {
    // Start anyway so /api/health can report what is wrong instead of the host showing a bare 503.
    console.error(`[oses] configuration problem: missing=${config.missing.join(",") || "-"} invalid=${config.invalid.join(",") || "-"} (NODE_ENV=${config.nodeEnv}). Set the environment variables and restart.`);
    return;
  }
  if (getEnv().JOB_RUNNER_MODE !== "inline") return;
  const { processJobsInline } = await import("@oses/automation");
  const { db } = await import("@oses/database");
  const log = createLogger("web.inline-ticker");
  const intervalMs = 60_000;
  const globalRef = globalThis as typeof globalThis & { __osesInlineTicker?: NodeJS.Timeout };
  if (globalRef.__osesInlineTicker) return;
  globalRef.__osesInlineTicker = setInterval(() => {
    processJobsInline(db, { timeBudgetMs: intervalMs - 5_000, maxJobs: 10 }).catch((err) => log.warn("inline tick failed", { error: errorMessage(err) }));
  }, intervalMs);
  globalRef.__osesInlineTicker.unref();
  log.info("inline job ticker started", { intervalMs });
}
