import { getOrCreateSettings } from "@oses/database";
import { createOutboundMessage, type PreferredProvider } from "@oses/messaging";
import { sendMessageSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";
import { kickInlineRunner } from "@/lib/server/jobs";

/** Send now: either record a manual send (user sends in the platform) or hand off to the resolved provider. */
export const POST = withApi(
  async (ctx) => {
    const settings = await getOrCreateSettings(ctx.db, ctx.organizationId);
    const result = await createOutboundMessage(ctx.db, serviceContext(ctx), { ...ctx.body, authorType: "USER", preferred: settings.preferredProvider as PreferredProvider });
    if (result.job) kickInlineRunner();
    return { message: result.message, decision: result.decision ? { providerKey: result.decision.providerKey, reason: result.decision.capability.reason, considered: result.decision.considered } : null, send: result.send, job: result.job, openUrl: result.openUrl, conversationId: result.conversationId };
  },
  { body: sendMessageSchema },
);
