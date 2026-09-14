/**
 * Background service worker: heartbeat, job claiming and orchestration of the content script.
 *
 * Flow:  alarm -> heartbeat -> claim job -> open target tab -> content script performs UI steps
 *        -> progress/result relayed to the OSES-J server -> next job.
 *
 * The worker never sees Instagram/Facebook credentials; it only drives the user's own session.
 */
import { loadConfig, loadState, logActivity, ServerClient, updateState, ApiError } from "../shared/api";
import type { ClaimedJob, ContentRequest, ContentResponse, JobResult, RuntimeEvent } from "../shared/protocol";

const ALARM = "oses-poll";
const POLL_MINUTES = 0.5;
const JOB_TIMEOUT_MS = 4 * 60_000;

let running = false;
let activeJob: { job: ClaimedJob; tabId: number; startedAt: number; resolve: (r: JobResult) => void; timer: number } | null = null;

chrome.runtime.onInstalled.addListener(() => void ensureAlarm());
chrome.runtime.onStartup.addListener(() => void ensureAlarm());
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void tick();
});
chrome.runtime.onMessage.addListener((message: RuntimeEvent | { type: "OSES_TICK_NOW" }, _sender, sendResponse) => {
  if (message.type === "OSES_TICK_NOW") {
    void tick().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.type === "OSES_JOB_PROGRESS" || message.type === "OSES_JOB_RESULT") void handleContentEvent(message);
  return false;
});

async function ensureAlarm(): Promise<void> {
  const existing = await chrome.alarms.get(ALARM);
  if (!existing) await chrome.alarms.create(ALARM, { periodInMinutes: POLL_MINUTES });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type Pong = Extract<ContentResponse, { type: "OSES_PONG" }>;

async function pingTab(tabId: number, attempts = 20): Promise<Pong | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = (await chrome.tabs.sendMessage(tabId, { type: "OSES_PING" } satisfies ContentRequest)) as ContentResponse | undefined;
      if (res?.type === "OSES_PONG") return res;
    } catch {
      /* content script not ready yet */
    }
    await sleep(500);
  }
  return null;
}

/** Find an existing platform tab (to reuse the session) without stealing focus. */
async function findPlatformTab(platform: "INSTAGRAM" | "FACEBOOK"): Promise<chrome.tabs.Tab | undefined> {
  const pattern = platform === "INSTAGRAM" ? "https://www.instagram.com/*" : "https://www.facebook.com/*";
  const tabs = await chrome.tabs.query({ url: pattern });
  return tabs.find((t) => t.id !== undefined && !t.discarded);
}

async function checkLogin(platform: "INSTAGRAM" | "FACEBOOK"): Promise<boolean | null> {
  const tab = await findPlatformTab(platform);
  if (!tab?.id) return null;
  const pong = await pingTab(tab.id, 2);
  return pong?.loggedIn ?? null;
}

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const config = await loadConfig();
    if (!config) return;
    const state = await loadState();
    if (activeJob && Date.now() - activeJob.startedAt > JOB_TIMEOUT_MS) {
      activeJob.resolve({ status: "FAILED", errorCode: "NAVIGATION_TIMEOUT", errorMessage: "Timed out waiting for the page" });
    }
    const client = new ServerClient(config);
    const loggedIn = { instagram: (await checkLogin("INSTAGRAM")) ?? state.loggedIn.instagram, facebook: (await checkLogin("FACEBOOK")) ?? state.loggedIn.facebook };
    await updateState({ loggedIn });
    const hb = await client.heartbeat({ status: config.paused ? "ready" : activeJob ? "busy" : loggedIn.instagram === false && loggedIn.facebook === false ? "needs_login" : "ready", loggedIn, currentJobId: activeJob?.job.id ?? null });
    await updateState({ lastHeartbeatAt: new Date().toISOString(), lastError: null });
    if (config.paused || !hb.extensionEnabled || activeJob) return;
    const platforms: Array<"INSTAGRAM" | "FACEBOOK"> = [];
    if (loggedIn.instagram !== false) platforms.push("INSTAGRAM");
    if (loggedIn.facebook !== false) platforms.push("FACEBOOK");
    if (!platforms.length) return;
    const { job } = await client.claim(platforms);
    await updateState({ lastClaimAt: new Date().toISOString() });
    if (!job) return;
    await logActivity("info", `Claimed job ${job.id.slice(-8)} for ${job.platform} @${job.target.username ?? "?"}`);
    await updateState({ currentJobId: job.id });
    const result = await executeJob(job, client);
    try {
      await client.result(job.id, result);
    } catch (err) {
      await logActivity("error", `Could not report result: ${(err as Error).message}`);
    }
    await updateState({ currentJobId: null });
    await logActivity(result.status === "SENT" ? "info" : "warn", `Job ${job.id.slice(-8)}: ${result.status}${result.errorCode ? ` (${result.errorCode})` : ""}${result.errorMessage ? ` – ${result.errorMessage}` : ""}`);
  } catch (err) {
    const message = err instanceof ApiError ? `${err.code}: ${err.message}` : (err as Error).message;
    await logActivity("error", message);
  } finally {
    running = false;
  }
}

async function executeJob(job: ClaimedJob, client: ServerClient): Promise<JobResult> {
  const targetUrl = job.target.profileUrl ?? (job.target.username ? (job.platform === "INSTAGRAM" ? `https://www.instagram.com/${job.target.username}/` : `https://www.facebook.com/${job.target.username}`) : job.target.inboxUrl);
  if (!targetUrl) return { status: "FAILED", errorCode: "TARGET_NOT_FOUND", errorMessage: "Job has no target URL" };
  await client.progress(job.id, "OPENING_TARGET", targetUrl).catch(() => undefined);
  const existing = await findPlatformTab(job.platform);
  const tab = existing?.id ? await chrome.tabs.update(existing.id, { url: targetUrl, active: false }) : await chrome.tabs.create({ url: targetUrl, active: false });
  if (!tab?.id) return { status: "FAILED", errorCode: "UNKNOWN", errorMessage: "Could not open a browser tab" };
  const tabId = tab.id;
  const pong = await pingTab(tabId, 40);
  if (!pong) return { status: "FAILED", errorCode: "NAVIGATION_TIMEOUT", errorMessage: "The page did not load in time" };
  if (pong.loggedIn === false) {
    await chrome.tabs.update(tabId, { active: true });
    return { status: "REQUIRES_USER", errorCode: "NOT_LOGGED_IN", errorMessage: `Please log in to ${job.platform === "INSTAGRAM" ? "Instagram" : "Facebook"} in the opened tab` };
  }
  return new Promise<JobResult>((resolve) => {
    const timer = setTimeout(() => finish({ status: "FAILED", errorCode: "NAVIGATION_TIMEOUT", errorMessage: "Timed out while sending" }), JOB_TIMEOUT_MS) as unknown as number;
    const finish = (r: JobResult) => {
      if (!activeJob || activeJob.job.id !== job.id) return;
      clearTimeout(activeJob.timer);
      activeJob = null;
      resolve(r);
    };
    activeJob = { job, tabId, startedAt: Date.now(), resolve: finish, timer };
    chrome.tabs.sendMessage(tabId, { type: "OSES_EXECUTE_JOB", job } satisfies ContentRequest).catch((err: Error) => finish({ status: "FAILED", errorCode: "UNKNOWN", errorMessage: `Content script error: ${err.message}` }));
  });
}

async function handleContentEvent(event: RuntimeEvent): Promise<void> {
  if (!activeJob || activeJob.job.id !== event.jobId) return;
  const config = await loadConfig();
  if (!config) return;
  const client = new ServerClient(config);
  if (event.type === "OSES_JOB_PROGRESS") {
    await client.progress(event.jobId, event.status, event.detail).catch(() => undefined);
    return;
  }
  if (event.result.status === "REQUIRES_USER") await chrome.tabs.update(activeJob.tabId, { active: true }).catch(() => undefined);
  activeJob.resolve(event.result);
}

void ensureAlarm();
