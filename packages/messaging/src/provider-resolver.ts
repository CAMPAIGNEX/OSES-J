import type { ClientSocialAccount, DbClient } from "@oses/database";
import { buildInboxUrl, type Platform } from "@oses/shared";
import { ApifyMessagingProvider, BrowserExtensionProvider, ManualMessagingProvider } from "./providers/basic";
import { MetaMessagingProvider } from "./providers/meta";
import type { CapabilityResult, MessageTarget, MessagingProvider, ProviderContext, ProviderDecision } from "./types";

export type PreferredProvider = "auto" | "meta" | "extension" | "apify" | "manual";

export const providers = {
  metaInstagram: new MetaMessagingProvider("INSTAGRAM"),
  metaFacebook: new MetaMessagingProvider("FACEBOOK"),
  extension: new BrowserExtensionProvider(),
  apify: new ApifyMessagingProvider(),
  manual: new ManualMessagingProvider(),
};

export function allProviders(): MessagingProvider[] {
  return [providers.metaInstagram, providers.metaFacebook, providers.extension, providers.apify, providers.manual];
}

export function providerByKey(key: string): MessagingProvider | null {
  return allProviders().find((p) => p.key === key) ?? null;
}

/** Build a MessageTarget from a client's social account row. */
export function targetFromSocialAccount(account: ClientSocialAccount, socialConnectionId: string | null = null): MessageTarget {
  return {
    platform: account.platform,
    clientId: account.clientId,
    clientSocialAccountId: account.id,
    username: account.username,
    profileUrl: account.profileUrl,
    inboxUrl: account.inboxUrl ?? buildInboxUrl(account.platform, { username: account.username, externalThreadId: account.externalThreadId, externalId: account.externalId }),
    externalId: account.externalId,
    externalThreadId: account.externalThreadId,
    scopedUserId: account.scopedUserId,
    socialConnectionId,
  };
}

/**
 * MessagingProviderResolver.
 *
 *   if official API is available and configured -> official provider
 *   else if browser extension is connected      -> extension
 *   else if Apify automation is enabled         -> Apify
 *   else                                        -> manual action required
 *
 * The decision (and every provider considered) is returned so it can be recorded on the message/job:
 * providers are never switched silently.
 */
export async function resolveMessagingProvider(db: DbClient, organizationId: string, target: MessageTarget, preferred: PreferredProvider = "auto"): Promise<ProviderDecision> {
  const ctx: ProviderContext = { db, organizationId };
  const official = target.platform === "INSTAGRAM" ? providers.metaInstagram : providers.metaFacebook;
  const order: MessagingProvider[] =
    preferred === "meta" ? [official] : preferred === "extension" ? [providers.extension] : preferred === "apify" ? [providers.apify] : preferred === "manual" ? [] : [official, providers.extension, providers.apify];
  const considered: ProviderDecision["considered"] = [];
  for (const p of order) {
    if (!p.platforms.includes(target.platform)) continue;
    const capability = await p.canSend(target, ctx);
    considered.push({ providerKey: p.key, capability });
    if (capability.canSend) return { provider: p, providerKey: p.key, capability, considered };
  }
  const manualCap = await providers.manual.canSend(target, ctx);
  considered.push({ providerKey: providers.manual.key, capability: manualCap });
  return { provider: null, providerKey: providers.manual.key, capability: manualCap, considered };
}

/** Assess and persist messaging eligibility for a client's social account without sending anything. */
export async function assessEligibility(db: DbClient, organizationId: string, account: ClientSocialAccount, preferred: PreferredProvider = "auto"): Promise<{ eligibility: CapabilityResult["eligibility"]; reason: string | null; providerKey: string; decision: ProviderDecision }> {
  const decision = await resolveMessagingProvider(db, organizationId, targetFromSocialAccount(account), preferred);
  const eligibility = decision.provider ? decision.capability.eligibility : "REQUIRES_USER";
  const reason = decision.provider ? decision.capability.reason : decision.considered.map((c) => `${c.providerKey}: ${c.capability.reason}`).join("; ");
  await db.clientSocialAccount.update({ where: { id: account.id }, data: { messagingEligibility: eligibility, eligibilityReason: reason?.slice(0, 300) ?? null, eligibilityCheckedAt: new Date() } });
  return { eligibility, reason, providerKey: decision.providerKey, decision };
}

export function platformLabel(platform: Platform): string {
  return platform === "INSTAGRAM" ? "Instagram" : "Facebook";
}
