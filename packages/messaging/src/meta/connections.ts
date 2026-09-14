import type { DbClient, SocialConnection } from "@oses/database";
import { writeAudit } from "@oses/database";
import { createLogger, decryptSecret, encryptSecret, errorMessage, getEnv, hmacSha256Hex, NotFoundError, randomToken, safeEqual } from "@oses/shared";
import { exchangeCodeForToken, exchangeForLongLivedToken, listManagedPages, subscribePageToWebhooks } from "./graph-client";

const log = createLogger("messaging.meta");

/** OAuth `state` is an HMAC-signed token so the callback can verify the organization/user without server-side storage. */
export function createOAuthState(organizationId: string, userId: string): string {
  const env = getEnv();
  const nonce = randomToken(12);
  const issued = Date.now().toString(36);
  const payload = `${organizationId}.${userId}.${issued}.${nonce}`;
  const sig = hmacSha256Hex(env.authSecret ?? "dev", payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function parseOAuthState(state: string): { organizationId: string; userId: string } | null {
  try {
    const env = getEnv();
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 5) return null;
    const [organizationId, userId, issued, nonce, sig] = parts as [string, string, string, string, string];
    const payload = `${organizationId}.${userId}.${issued}.${nonce}`;
    if (!safeEqual(hmacSha256Hex(env.authSecret ?? "dev", payload), sig)) return null;
    if (Date.now() - Number.parseInt(issued, 36) > 15 * 60_000) return null;
    return { organizationId, userId };
  } catch {
    return null;
  }
}

export function metaRedirectUri(): string {
  return `${getEnv().APP_URL.replace(/\/$/, "")}/api/social/meta/callback`;
}

/**
 * Complete the OAuth flow: exchange the code, upgrade to a long-lived token, fetch the pages the user
 * manages, and store one SocialConnection per Facebook Page and per linked Instagram professional account.
 * Page access tokens are stored encrypted; user tokens are never persisted.
 */
export async function completeMetaConnection(db: DbClient, organizationId: string, userId: string, code: string): Promise<{ connections: SocialConnection[]; warnings: string[] }> {
  const env = getEnv();
  const warnings: string[] = [];
  const shortLived = await exchangeCodeForToken(code, metaRedirectUri());
  let userToken = shortLived.access_token;
  try {
    userToken = (await exchangeForLongLivedToken(shortLived.access_token)).access_token;
  } catch (err) {
    warnings.push(`Could not obtain a long-lived token: ${errorMessage(err)}`);
  }
  const pages = await listManagedPages(userToken);
  if (!pages.length) warnings.push("The Facebook account does not manage any Pages. Instagram messaging requires a Page linked to a professional Instagram account.");
  const connections: SocialConnection[] = [];
  for (const page of pages) {
    const encrypted = encryptSecret(page.access_token, env.ENCRYPTION_KEY);
    try {
      await subscribePageToWebhooks(page.id, page.access_token);
    } catch (err) {
      warnings.push(`Webhook subscription for page ${page.name} failed: ${errorMessage(err)}`);
    }
    const fb = await db.socialConnection.upsert({
      where: { organizationId_platform_externalAccountId: { organizationId, platform: "FACEBOOK", externalAccountId: page.id } },
      create: { organizationId, platform: "FACEBOOK", provider: "meta", externalAccountId: page.id, pageId: page.id, displayName: page.name, accessTokenEncrypted: encrypted, status: "CONNECTED", scopes: {} as object, connectedByUserId: userId, meta: { pageName: page.name } as object },
      update: { displayName: page.name, accessTokenEncrypted: encrypted, status: "CONNECTED", lastError: null, connectedByUserId: userId, pageId: page.id },
    });
    connections.push(fb);
    if (page.instagram_business_account?.id) {
      const ig = page.instagram_business_account;
      const igRow = await db.socialConnection.upsert({
        where: { organizationId_platform_externalAccountId: { organizationId, platform: "INSTAGRAM", externalAccountId: ig.id } },
        create: { organizationId, platform: "INSTAGRAM", provider: "meta", externalAccountId: ig.id, pageId: page.id, username: ig.username ?? null, displayName: ig.name ?? ig.username ?? page.name, accessTokenEncrypted: encrypted, status: "CONNECTED", connectedByUserId: userId, meta: { pageName: page.name, pageId: page.id } as object },
        update: { username: ig.username ?? null, displayName: ig.name ?? ig.username ?? page.name, accessTokenEncrypted: encrypted, status: "CONNECTED", lastError: null, connectedByUserId: userId, pageId: page.id },
      });
      connections.push(igRow);
    }
  }
  await writeAudit(db, { organizationId, userId, action: "social.connected", entityType: "SocialConnection", meta: { pages: pages.length, connections: connections.length } });
  log.info("meta connection completed", { organizationId, connections: connections.length });
  return { connections, warnings };
}

export async function disconnectSocialConnection(db: DbClient, organizationId: string, userId: string | null, connectionId: string): Promise<void> {
  const row = await db.socialConnection.findFirst({ where: { id: connectionId, organizationId } });
  if (!row) throw new NotFoundError("Social connection");
  await db.socialConnection.update({ where: { id: row.id }, data: { status: "DISCONNECTED", accessTokenEncrypted: null } });
  await writeAudit(db, { organizationId, userId, action: "social.disconnected", entityType: "SocialConnection", entityId: row.id, meta: { platform: row.platform } });
}

export function connectionToken(connection: SocialConnection): string | null {
  if (!connection.accessTokenEncrypted) return null;
  try {
    return decryptSecret(connection.accessTokenEncrypted, getEnv().ENCRYPTION_KEY);
  } catch (err) {
    log.warn("could not decrypt social connection token", { connectionId: connection.id, error: errorMessage(err) });
    return null;
  }
}

/** Public-safe projection for API responses (never includes tokens). */
export function connectionSummary(c: SocialConnection) {
  return {
    id: c.id,
    platform: c.platform,
    provider: c.provider,
    externalAccountId: c.externalAccountId,
    pageId: c.pageId,
    username: c.username,
    displayName: c.displayName,
    status: c.status,
    hasToken: Boolean(c.accessTokenEncrypted),
    tokenExpiresAt: c.tokenExpiresAt,
    lastError: c.lastError,
    lastSyncedAt: c.lastSyncedAt,
    createdAt: c.createdAt,
  };
}
