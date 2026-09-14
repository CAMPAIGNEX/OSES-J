import { summarizeConversation } from "@oses/ai";
import { loadClientWithRelations, toClientProfile } from "@oses/automation";
import { loadConversationForAI } from "@oses/messaging";
import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => {
  const conv = await ctx.db.conversation.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
  if (!conv) throw new NotFoundError("Conversation");
  const client = await loadClientWithRelations(ctx.db, ctx.organizationId, conv.clientId);
  if (!client) throw new NotFoundError("Client");
  const history = await loadConversationForAI(ctx.db, conv.id, 80);
  const outcome = await summarizeConversation({ db: ctx.db, organizationId: ctx.organizationId, triggeredBy: "USER", userId: ctx.userId, clientId: client.id, conversationId: conv.id }, history, toClientProfile(client, conv.channel));
  await ctx.db.conversation.update({ where: { id: conv.id }, data: { summary: outcome.result.summary, summaryUpdatedAt: new Date() } });
  return { summary: outcome.result, actionLogId: outcome.actionLogId };
});
