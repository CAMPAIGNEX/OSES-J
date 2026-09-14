import { getClientByCid } from "@oses/crm";
import { assessEligibility } from "@oses/messaging";
import { serviceContext, withApi } from "@/lib/server/api";

/** Re-check whether each social account can be messaged with the currently configured providers. */
export const POST = withApi(async (ctx) => {
  const client = await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "");
  const results = [];
  for (const account of client.socialAccounts) {
    const r = await assessEligibility(ctx.db, ctx.organizationId, account);
    results.push({ accountId: account.id, platform: account.platform, eligibility: r.eligibility, reason: r.reason, providerKey: r.providerKey, considered: r.decision.considered });
  }
  return { results };
});
