import type { DbClient, ExtensionDevice, MessageJob } from "@oses/database";
import { writeAudit } from "@oses/database";
import { addMinutes, AuthError, ConflictError, getEnv, NotFoundError, randomCode, randomToken, sha256Hex, type Platform } from "@oses/shared";
import type { ExtensionResultInput } from "@oses/validation";
import { recordJobResult } from "./message-service";
import { EXTENSION_ONLINE_WINDOW_MS } from "./providers/basic";
import type { MessageJobPayload, MessageJobTarget } from "./types";

const CLAIM_LEASE_MINUTES = 10;

export interface DeviceTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

async function issueTokens(db: DbClient, deviceId: string): Promise<DeviceTokens> {
  const env = getEnv();
  const accessToken = randomToken(32);
  const refreshToken = randomToken(48);
  const accessTokenExpiresAt = addMinutes(new Date(), env.EXTENSION_ACCESS_TOKEN_TTL_MINUTES);
  const refreshTokenExpiresAt = addMinutes(new Date(), env.EXTENSION_REFRESH_TOKEN_TTL_DAYS * 24 * 60);
  await db.extensionDevice.update({
    where: { id: deviceId },
    data: { accessTokenHash: sha256Hex(accessToken), accessTokenExpiresAt, refreshTokenHash: sha256Hex(refreshToken), refreshTokenExpiresAt },
  });
  return { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt };
}

/** Step 1 (web app): create a short-lived pairing code the user types into the extension. */
export async function createPairingCode(db: DbClient, organizationId: string, userId: string): Promise<{ code: string; expiresAt: Date }> {
  const code = randomCode(8);
  const expiresAt = addMinutes(new Date(), 10);
  await db.extensionPairing.create({ data: { organizationId, userId, codeHash: sha256Hex(code), expiresAt } });
  return { code, expiresAt };
}

/** Step 2 (extension): exchange the pairing code for device tokens. The OSES J password never reaches the extension. */
export async function pairDevice(db: DbClient, input: { pairingCode: string; deviceName: string; browser?: string; extensionVersion?: string }): Promise<{ device: ExtensionDevice; tokens: DeviceTokens }> {
  const pairing = await db.extensionPairing.findUnique({ where: { codeHash: sha256Hex(input.pairingCode.trim().toUpperCase()) } });
  if (!pairing || pairing.usedAt || pairing.expiresAt < new Date()) throw new AuthError("Pairing code is invalid or expired");
  const device = await db.extensionDevice.create({
    data: { organizationId: pairing.organizationId, userId: pairing.userId, name: input.deviceName, browser: input.browser ?? null, extensionVersion: input.extensionVersion ?? null, status: "ONLINE", lastSeenAt: new Date(), lastStatus: "ready" },
  });
  await db.extensionPairing.update({ where: { id: pairing.id }, data: { usedAt: new Date(), deviceId: device.id } });
  const tokens = await issueTokens(db, device.id);
  await writeAudit(db, { organizationId: device.organizationId, userId: device.userId, action: "extension.paired", entityType: "ExtensionDevice", entityId: device.id, meta: { browser: input.browser, version: input.extensionVersion } });
  return { device, tokens };
}

export async function refreshDeviceTokens(db: DbClient, refreshToken: string): Promise<{ device: ExtensionDevice; tokens: DeviceTokens }> {
  const device = await db.extensionDevice.findUnique({ where: { refreshTokenHash: sha256Hex(refreshToken) } });
  if (!device || device.revokedAt || device.status === "REVOKED" || !device.refreshTokenExpiresAt || device.refreshTokenExpiresAt < new Date()) throw new AuthError("Refresh token is invalid or expired");
  const tokens = await issueTokens(db, device.id);
  return { device, tokens };
}

/** Authenticate a bearer access token from the extension. */
export async function authenticateDevice(db: DbClient, accessToken: string | null | undefined): Promise<ExtensionDevice> {
  if (!accessToken) throw new AuthError("Extension token required");
  const device = await db.extensionDevice.findUnique({ where: { accessTokenHash: sha256Hex(accessToken) } });
  if (!device || device.revokedAt || device.status === "REVOKED") throw new AuthError("Extension token is invalid");
  if (!device.accessTokenExpiresAt || device.accessTokenExpiresAt < new Date()) throw new AuthError("Extension token expired");
  return device;
}

export async function heartbeat(db: DbClient, device: ExtensionDevice, input: { status: string; capabilities?: Record<string, unknown>; extensionVersion?: string; currentJobId?: string | null }): Promise<void> {
  await db.extensionDevice.update({
    where: { id: device.id },
    data: { status: "ONLINE", lastSeenAt: new Date(), lastStatus: input.status, capabilities: input.capabilities ? (input.capabilities as object) : undefined, extensionVersion: input.extensionVersion ?? device.extensionVersion },
  });
  if (input.currentJobId) await db.messageJob.updateMany({ where: { id: input.currentJobId, claimedByDeviceId: device.id }, data: { lastHeartbeatAt: new Date(), leaseExpiresAt: addMinutes(new Date(), CLAIM_LEASE_MINUTES) } });
}

export interface ClaimedJob {
  id: string;
  platform: Platform;
  target: MessageJobTarget;
  payload: MessageJobPayload;
  attempts: number;
  maxAttempts: number;
  leaseExpiresAt: Date;
}

/**
 * Atomically claim the next queued extension job for the device's organization.
 * Uses a conditional UPDATE so two devices can never claim the same job.
 */
export async function claimNextJob(db: DbClient, device: ExtensionDevice, platforms: Platform[]): Promise<ClaimedJob | null> {
  const settings = await db.organizationSettings.findUnique({ where: { organizationId: device.organizationId }, select: { extensionEnabled: true } });
  if (settings && !settings.extensionEnabled) return null;
  const now = new Date();
  // Release expired leases first (device crashed mid-job).
  await db.messageJob.updateMany({ where: { organizationId: device.organizationId, provider: "EXTENSION", status: { in: ["CLAIMED", "OPENING_TARGET", "TARGET_FOUND", "COMPOSER_FOUND", "SENDING"] }, leaseExpiresAt: { lt: now } }, data: { status: "QUEUED", claimedByDeviceId: null, leaseExpiresAt: null, progressDetail: "lease expired; re-queued" } });
  for (let attempt = 0; attempt < 3; attempt++) {
    const candidate = await db.messageJob.findFirst({
      where: { organizationId: device.organizationId, provider: "EXTENSION", status: "QUEUED", scheduledAt: { lte: now } },
      orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }],
    });
    if (!candidate) return null;
    const target = candidate.target as unknown as MessageJobTarget;
    if (!platforms.includes(target.platform)) {
      // Nothing this device can handle right now for the highest-priority job; look at others.
      const other = await db.messageJob.findFirst({ where: { organizationId: device.organizationId, provider: "EXTENSION", status: "QUEUED", scheduledAt: { lte: now }, NOT: { id: candidate.id } }, orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }] });
      if (!other) return null;
    }
    const leaseExpiresAt = addMinutes(now, CLAIM_LEASE_MINUTES);
    const res = await db.messageJob.updateMany({ where: { id: candidate.id, status: "QUEUED" }, data: { status: "CLAIMED", claimedAt: now, claimedByDeviceId: device.id, leaseExpiresAt, lastHeartbeatAt: now, attempts: { increment: 1 } } });
    if (res.count === 1) {
      await db.message.updateMany({ where: { id: candidate.messageId }, data: { status: "SENDING" } });
      return { id: candidate.id, platform: target.platform, target, payload: candidate.payload as unknown as MessageJobPayload, attempts: candidate.attempts + 1, maxAttempts: candidate.maxAttempts, leaseExpiresAt };
    }
  }
  return null;
}

async function ownedJob(db: DbClient, device: ExtensionDevice, jobId: string): Promise<MessageJob> {
  const job = await db.messageJob.findFirst({ where: { id: jobId, organizationId: device.organizationId } });
  if (!job) throw new NotFoundError("Job");
  if (job.claimedByDeviceId !== device.id) throw new ConflictError("Job is not claimed by this device");
  return job;
}

export async function reportProgress(db: DbClient, device: ExtensionDevice, jobId: string, status: "OPENING_TARGET" | "TARGET_FOUND" | "COMPOSER_FOUND" | "SENDING", detail?: string): Promise<void> {
  const job = await ownedJob(db, device, jobId);
  if (["SENT", "FAILED", "CANCELLED", "BLOCKED", "REQUIRES_USER"].includes(job.status)) throw new ConflictError("Job already finished");
  await db.messageJob.update({ where: { id: jobId }, data: { status, progressDetail: detail?.slice(0, 500) ?? null, lastHeartbeatAt: new Date(), leaseExpiresAt: addMinutes(new Date(), CLAIM_LEASE_MINUTES) } });
}

const PERMANENT_CODES = new Set(["TARGET_NOT_FOUND", "MESSAGE_BUTTON_NOT_FOUND"]);
const USER_CODES = new Set(["NOT_LOGGED_IN", "ACCOUNT_RESTRICTED", "PAGE_WARNING"]);

export async function reportResult(db: DbClient, device: ExtensionDevice, jobId: string, input: ExtensionResultInput): Promise<MessageJob> {
  const job = await ownedJob(db, device, jobId);
  if (["SENT", "FAILED", "CANCELLED", "BLOCKED", "REQUIRES_USER"].includes(job.status)) throw new ConflictError("Job already finished");
  if (input.status === "SENT") {
    return recordJobResult(db, jobId, { status: "SENT", externalThreadId: input.evidence?.threadId ?? null, result: { evidence: input.evidence ?? null, deviceId: device.id } });
  }
  const code = input.errorCode ?? "UNKNOWN";
  if (input.status === "REQUIRES_USER" || USER_CODES.has(code)) {
    if (code === "NOT_LOGGED_IN") await db.extensionDevice.update({ where: { id: device.id }, data: { lastStatus: "needs_login" } });
    return recordJobResult(db, jobId, { status: "REQUIRES_USER", errorCode: code, errorMessage: input.errorMessage ?? null, errorClass: "USER_ACTION_REQUIRED", result: { evidence: input.evidence ?? null, deviceId: device.id } });
  }
  if (input.status === "BLOCKED") {
    return recordJobResult(db, jobId, { status: "BLOCKED", errorCode: code, errorMessage: input.errorMessage ?? null, errorClass: "TARGET_UNAVAILABLE", result: { evidence: input.evidence ?? null, deviceId: device.id } });
  }
  const permanent = PERMANENT_CODES.has(code);
  const rateLimited = code === "RATE_LIMITED";
  if (!permanent && job.attempts < job.maxAttempts) {
    const delayMs = rateLimited ? 30 * 60_000 : [30_000, 120_000, 600_000][Math.min(job.attempts - 1, 2)] ?? 600_000;
    return recordJobResult(db, jobId, { status: "RETRYING", errorCode: code, errorMessage: input.errorMessage ?? null, errorClass: rateLimited ? "RATE_LIMIT" : "TEMPORARY", retryAt: new Date(Date.now() + delayMs), result: { evidence: input.evidence ?? null, deviceId: device.id } });
  }
  return recordJobResult(db, jobId, { status: "FAILED", errorCode: code, errorMessage: input.errorMessage ?? null, errorClass: permanent ? "TARGET_UNAVAILABLE" : "PERMANENT", result: { evidence: input.evidence ?? null, deviceId: device.id } });
}

export async function revokeDevice(db: DbClient, organizationId: string, userId: string | null, deviceId: string): Promise<void> {
  const res = await db.extensionDevice.updateMany({ where: { id: deviceId, organizationId }, data: { status: "REVOKED", revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null } });
  if (!res.count) throw new NotFoundError("Extension device");
  await writeAudit(db, { organizationId, userId, action: "extension.revoked", entityType: "ExtensionDevice", entityId: deviceId });
}

export async function listDevices(db: DbClient, organizationId: string) {
  const devices = await db.extensionDevice.findMany({ where: { organizationId, revokedAt: null }, orderBy: { lastSeenAt: "desc" } });
  const threshold = Date.now() - EXTENSION_ONLINE_WINDOW_MS;
  return devices.map((d) => ({
    id: d.id,
    name: d.name,
    browser: d.browser,
    extensionVersion: d.extensionVersion,
    status: d.lastSeenAt && d.lastSeenAt.getTime() >= threshold && d.status === "ONLINE" ? "ONLINE" : "OFFLINE",
    lastSeenAt: d.lastSeenAt,
    lastStatus: d.lastStatus,
    capabilities: d.capabilities,
    createdAt: d.createdAt,
  }));
}

/** Mark devices offline when they stop sending heartbeats (called by the scheduler). */
export async function sweepOfflineDevices(db: DbClient): Promise<number> {
  const threshold = new Date(Date.now() - EXTENSION_ONLINE_WINDOW_MS * 2);
  const res = await db.extensionDevice.updateMany({ where: { status: "ONLINE", lastSeenAt: { lt: threshold } }, data: { status: "OFFLINE" } });
  return res.count;
}
