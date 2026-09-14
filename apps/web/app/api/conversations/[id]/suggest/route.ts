import { classifyIntent, generateReply } from "@oses/ai";
import { loadClientWithRelations, toClientProfile } from "@oses/automation";
import { loadConversationForAI } from "@oses/messaging";
import { NotFoundError } from "@oses/shared";
import { aiReplySuggestionSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

/** Copilot: classify the latest inbound message and draft a reply for the user to review. */
export const POST = withApi(
  async (ctx) => {
    const conv = await ctx.db.conversation.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
    if (!conv) throw new NotFoundError("Conversation");
    const client = await loadClientWithRelations(ctx.db, ctx.organizationId, conv.clientId);
    if (!client) throw new NotFoundError("Client");
    const profile = toClientProfile(client, conv.channel);
    const history = await loadConversationForAI(ctx.db, conv.id);
    const agent = { db: ctx.db, organizationId: ctx.organizationId, triggeredBy: "USER" as const, userId: ctx.userId, clientId: client.id, conversationId: conv.id };
    const hasInbound = history.messages.some((m) => m.direction === "INBOUND");
    const intent = hasInbound ? (await classifyIntent(agent, history, profile)).result : null;
    if (intent) await ctx.db.conversation.update({ where: { id: conv.id }, data: { lastIntent: intent.intent, lastIntentConfidence: intent.confidence } });
    const reply = await generateReply(agent, { client: profile, conversation: history, intent, instruction: ctx.body.instruction, kind: hasInbound ? "reply" : "follow_up", followUpStep: hasInbound ? undefined : 1 });
    return { intent, draft: reply.result.message, validation: reply.result.validation, openQuestions: reply.result.openQuestions, factsUsed: reply.result.factsUsed, confidence: reply.result.confidence, actionLogId: reply.actionLogId, model: reply.model };
  },
  { body: aiReplySuggestionSchema.omit({ conversationId: true }) },
);
