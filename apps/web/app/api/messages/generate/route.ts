import { generateFirstMessage, generateReply, transformDraft } from "@oses/ai";
import { loadClientWithRelations, toClientProfile } from "@oses/automation";
import { loadConversationForAI } from "@oses/messaging";
import { NotFoundError } from "@oses/shared";
import { generateMessageSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

/**
 * AI message generation for the composer: first contact, reply or follow-up, plus draft variants
 * (shorter, more professional, ...). Nothing is sent here; the draft returns to the user.
 */
export const POST = withApi(
  async (ctx) => {
    const input = ctx.body;
    const client = await loadClientWithRelations(ctx.db, ctx.organizationId, input.clientId);
    if (!client) throw new NotFoundError("Client");
    const channel = input.channel ?? client.socialAccounts[0]?.platform ?? "INSTAGRAM";
    const profile = toClientProfile(client, channel);
    const agent = { db: ctx.db, organizationId: ctx.organizationId, triggeredBy: "USER" as const, userId: ctx.userId, clientId: client.id, conversationId: input.conversationId ?? null };
    let outcome;
    if (input.variant && input.previousDraft && input.variant !== "regenerate") {
      outcome = await transformDraft(agent, input.previousDraft, input.variant, profile);
    } else if (input.kind === "first_contact") {
      outcome = await generateFirstMessage(agent, { client: profile, channel, instruction: input.instruction, variant: input.variant, previousDraft: input.previousDraft });
    } else {
      if (!input.conversationId) throw new NotFoundError("Conversation");
      const conversation = await loadConversationForAI(ctx.db, input.conversationId);
      outcome = await generateReply(agent, { client: profile, conversation, instruction: input.instruction, kind: input.kind === "follow_up" ? "follow_up" : "reply" });
    }
    return { draft: outcome.result.message, validation: outcome.result.validation, personalizationUsed: outcome.result.personalizationUsed, factsUsed: outcome.result.factsUsed, openQuestions: outcome.result.openQuestions, confidence: outcome.result.confidence, actionLogId: outcome.actionLogId, model: outcome.model, provider: outcome.provider, channel };
  },
  { body: generateMessageSchema },
);
