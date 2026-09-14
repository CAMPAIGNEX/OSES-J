import { logManualMessage } from "@oses/messaging";
import { logManualMessageSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";
import { enqueueJob } from "@/lib/server/jobs";

/** Record a message exchanged outside OSES J. Inbound entries trigger the AI reply pipeline. */
export const POST = withApi(
  async (ctx) => {
    const message = await logManualMessage(ctx.db, serviceContext(ctx), { conversationId: ctx.body.conversationId, direction: ctx.body.direction, body: ctx.body.body, sentAt: ctx.body.sentAt ? new Date(ctx.body.sentAt) : undefined });
    if (ctx.body.direction === "INBOUND") {
      await enqueueJob({ type: "AI_REPLY_JOB", organizationId: ctx.organizationId, payload: { conversationId: ctx.body.conversationId }, priority: 3, dedupeKey: `ai-reply:${ctx.body.conversationId}:${message.id}`, entityType: "Conversation", entityId: ctx.body.conversationId });
    }
    return { message };
  },
  { body: logManualMessageSchema },
);
