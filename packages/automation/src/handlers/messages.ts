import { ApifyClient, assertRunSucceeded } from "@oses/apify";
import { resolveApifyToken } from "@oses/discovery";
import { createOutboundMessage, MetaMessagingProvider, recordJobResult, type MessageJobPayload, type MessageJobTarget } from "@oses/messaging";
import { createLogger, errorMessage, classifyError, isWithinWorkingHours, type ErrorClass } from "@oses/shared";
import { isContactable, loadPolicy, nextSendTime, timezoneForClient } from "../autopilot";
import type { JobContext } from "../runner";

const log = createLogger("automation.messages");

type Item = Record<string, unknown>;

function fillTemplate(value: unknown, vars: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const exact = /^\{\{(\w+)\}\}$/.exec(value.trim());
    if (exact && exact[1] && exact[1] in vars) return vars[exact[1]];
    return value.replace(/\{\{(\w+)\}\}/g, (_m, k: string) => (vars[k] == null ? "" : String(vars[k])));
  }
  if (Array.isArray(value)) return value.map((v) => fillTemplate(v, vars));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Item).map(([k, v]) => [k, fillTemplate(v, vars)]));
  return value;
}

/** Interpret an Apify DM Actor's dataset to decide whether the message was really sent. */
export function interpretDmActorItems(items: Item[], rule: "item_status" | "run_succeeded"): { sent: boolean; reason: string; threadId: string | null } {
  if (rule === "run_succeeded") return { sent: true, reason: "Actor run succeeded", threadId: null };
  if (!items.length) return { sent: false, reason: "Actor finished without a delivery confirmation item", threadId: null };
  const first = items[0] as Item;
  const status = String(first.status ?? first.result ?? first.state ?? "").toLowerCase();
  const errorText = typeof first.error === "string" ? first.error : typeof first.errorMessage === "string" ? first.errorMessage : null;
  const threadId = typeof first.threadId === "string" ? first.threadId : typeof first.thread_id === "string" ? first.thread_id : null;
  if (errorText) return { sent: false, reason: errorText, threadId };
  if (first.success === true || first.sent === true || /^(sent|success|ok|delivered|done)$/.test(status)) return { sent: true, reason: "Actor reported success", threadId };
  if (first.success === false || first.sent === false || /fail|error|blocked|not_found|unavailable/.test(status)) return { sent: false, reason: status || "Actor reported failure", threadId };
  return { sent: false, reason: "Actor output did not confirm delivery", threadId };
}

async function runApifyMessageJob(ctx: JobContext, jobId: string, target: MessageJobTarget, payload: MessageJobPayload, organizationId: string): Promise<void> {
  const provider = (payload.provider ?? {}) as { actorId?: string; settings?: Item; timeoutSec?: number };
  const settings = provider.settings ?? {};
  const { token } = await resolveApifyToken(ctx.db, organizationId);
  if (!token || !provider.actorId) {
    await recordJobResult(ctx.db, jobId, { status: "REQUIRES_USER", errorCode: "APIFY_NOT_CONFIGURED", errorMessage: "Apify token or messaging Actor is not configured", errorClass: "USER_ACTION_REQUIRED" });
    return;
  }
  const template = (settings.inputTemplate as Item | undefined) ?? { username: "{{username}}", message: "{{message}}" };
  const input = fillTemplate(template, { username: target.username, profileUrl: target.profileUrl, inboxUrl: target.inboxUrl, threadUrl: target.inboxUrl, threadId: target.externalThreadId, message: payload.text, text: payload.text });
  const client = new ApifyClient({ token });
  const startedAt = new Date();
  let externalRunId: string | null = null;
  try {
    await ctx.db.messageJob.update({ where: { id: jobId }, data: { status: "SENDING", progressDetail: `Running Actor ${provider.actorId}` } });
    const run = await client.startRun(provider.actorId, input, { timeoutSecs: provider.timeoutSec ?? 600 });
    externalRunId = run.id;
    const finished = await client.waitForRun(run.id, { timeoutMs: (provider.timeoutSec ?? 600) * 1000 + 30_000, pollIntervalMs: 5000 });
    assertRunSucceeded(finished);
    const items = await client.getAllDatasetItems<Item>(finished.defaultDatasetId, 20);
    const providerRun = await ctx.db.providerRun.create({ data: { organizationId, purpose: "MESSAGING", provider: "apify", actorId: provider.actorId, adapter: "generic-dm", externalRunId: run.id, datasetId: finished.defaultDatasetId, status: "SUCCEEDED", input: input as object, itemCount: items.length, costUsd: finished.usageTotalUsd ?? null, startedAt, finishedAt: new Date() } });
    const verdict = interpretDmActorItems(items, (settings.successRule as "item_status" | "run_succeeded" | undefined) ?? "item_status");
    if (verdict.sent) {
      await recordJobResult(ctx.db, jobId, { status: "SENT", externalThreadId: verdict.threadId, result: { providerRunId: providerRun.id, externalRunId: run.id, reason: verdict.reason } });
    } else {
      await recordJobResult(ctx.db, jobId, { status: "REQUIRES_USER", errorCode: "ACTOR_UNCONFIRMED", errorMessage: verdict.reason, errorClass: "TARGET_UNAVAILABLE", result: { providerRunId: providerRun.id, externalRunId: run.id, items: items.slice(0, 3) } });
    }
  } catch (err) {
    const errorClass: ErrorClass = classifyError(err);
    await ctx.db.providerRun.create({ data: { organizationId, purpose: "MESSAGING", provider: "apify", actorId: provider.actorId, adapter: "generic-dm", externalRunId, status: "FAILED", input: input as object, error: errorMessage(err), startedAt, finishedAt: new Date() } }).catch(() => undefined);
    const job = await ctx.db.messageJob.findUniqueOrThrow({ where: { id: jobId } });
    const retry = (errorClass === "TEMPORARY" || errorClass === "RATE_LIMIT") && job.attempts < job.maxAttempts;
    await recordJobResult(ctx.db, jobId, { status: retry ? "RETRYING" : "FAILED", errorCode: "ACTOR_FAILED", errorMessage: errorMessage(err), errorClass, retryAt: retry ? new Date(Date.now() + 120_000) : null });
    if (retry) await ctx.queue.enqueue({ type: "MESSAGE_JOB", organizationId, payload: { messageJobId: jobId }, scheduledAt: new Date(Date.now() + 120_000), dedupeKey: `message-job:${jobId}:${job.attempts + 1}` });
  }
}

/** MESSAGE_JOB: execute a MessageJob for providers the server can drive (Meta, Apify). Extension jobs are pulled by the device. */
export async function handleMessageJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const jobId = String(ctx.payload.messageJobId ?? "");
  const job = await ctx.db.messageJob.findUnique({ where: { id: jobId } });
  if (!job) return { skipped: "message job not found" };
  if (!["QUEUED", "RETRYING"].includes(job.status)) return { skipped: `job status ${job.status}` };
  const target = job.target as unknown as MessageJobTarget;
  const payload = job.payload as unknown as MessageJobPayload;
  if (job.provider === "EXTENSION") return { skipped: "extension jobs are claimed by the browser extension" };
  await ctx.db.messageJob.update({ where: { id: jobId }, data: { status: "CLAIMED", claimedAt: new Date(), attempts: { increment: 1 } } });
  await ctx.db.message.updateMany({ where: { id: job.messageId }, data: { status: "SENDING" } });
  if (job.provider === "META") {
    const provider = new MetaMessagingProvider(target.platform);
    try {
      const res = await provider.deliver({ db: ctx.db, organizationId: job.organizationId }, target, payload.text);
      await recordJobResult(ctx.db, jobId, { status: "SENT", providerMessageId: res.providerMessageId, result: { recipientId: res.recipientId } });
      return { sent: true, providerMessageId: res.providerMessageId };
    } catch (err) {
      const errorClass = classifyError(err);
      const fresh = await ctx.db.messageJob.findUniqueOrThrow({ where: { id: jobId } });
      const retry = (errorClass === "TEMPORARY" || errorClass === "RATE_LIMIT") && fresh.attempts < fresh.maxAttempts;
      await recordJobResult(ctx.db, jobId, { status: retry ? "RETRYING" : errorClass === "AUTHENTICATION" ? "REQUIRES_USER" : "FAILED", errorCode: errorClass, errorMessage: errorMessage(err), errorClass, retryAt: retry ? new Date(Date.now() + 60_000) : null });
      if (retry) await ctx.queue.enqueue({ type: "MESSAGE_JOB", organizationId: job.organizationId, payload: { messageJobId: jobId }, scheduledAt: new Date(Date.now() + 60_000), dedupeKey: `message-job:${jobId}:${fresh.attempts + 1}` });
      return { sent: false, error: errorMessage(err) };
    }
  }
  await runApifyMessageJob(ctx, jobId, target, payload, job.organizationId);
  return { provider: job.provider };
}

/** SCHEDULED_MESSAGE_JOB: a scheduled message became due. */
export async function handleScheduledMessageJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const id = String(ctx.payload.scheduledMessageId ?? "");
  const scheduled = await ctx.db.scheduledMessage.findUnique({ where: { id } });
  if (!scheduled) return { skipped: "not found" };
  if (!["SCHEDULED", "QUEUED"].includes(scheduled.status)) return { skipped: `status ${scheduled.status}` };
  const client = await ctx.db.client.findUnique({ where: { id: scheduled.clientId } });
  if (!client || !isContactable(client)) {
    await ctx.db.scheduledMessage.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), error: "client not contactable" } });
    return { skipped: "client not contactable" };
  }
  // Follow-ups must not go out once the prospect replied.
  if (scheduled.followUpStep && scheduled.conversationId) {
    const conv = await ctx.db.conversation.findUnique({ where: { id: scheduled.conversationId } });
    if (conv?.lastInboundAt) {
      await ctx.db.scheduledMessage.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date(), error: "client replied before the follow-up" } });
      return { skipped: "client replied" };
    }
  }
  const policy = await loadPolicy(ctx.db, scheduled.organizationId);
  if (scheduled.createdByType === "AI" && policy.workingHours.enabled) {
    const tz = timezoneForClient(policy, client);
    if (!isWithinWorkingHours(new Date(), tz, policy.workingHours)) {
      const next = nextSendTime(policy, client);
      await ctx.db.scheduledMessage.update({ where: { id }, data: { scheduledAt: next.at, status: "SCHEDULED", jobId: null } });
      log.info("scheduled message pushed to next working slot", { id, at: next.at.toISOString() });
      return { rescheduled: next.at.toISOString() };
    }
  }
  try {
    const res = await createOutboundMessage(ctx.db, { organizationId: scheduled.organizationId, userId: scheduled.createdByUserId }, { clientId: client.id, conversationId: scheduled.conversationId ?? undefined, channel: scheduled.channel, body: scheduled.body, delivery: "automation", aiActionLogId: scheduled.aiActionLogId ?? undefined, campaignId: scheduled.campaignId ?? undefined, authorType: scheduled.createdByType === "AI" ? "AI" : "USER", preferred: policy.preferredProvider });
    await ctx.db.scheduledMessage.update({ where: { id }, data: { status: res.message.status === "UNAVAILABLE" || res.message.status === "FAILED" ? "FAILED" : "SENT", messageId: res.message.id, sentAt: new Date(), error: res.message.failureReason ?? null } });
    return { messageId: res.message.id, status: res.message.status };
  } catch (err) {
    await ctx.db.scheduledMessage.update({ where: { id }, data: { status: "FAILED", error: errorMessage(err).slice(0, 2000) } });
    throw err;
  }
}
