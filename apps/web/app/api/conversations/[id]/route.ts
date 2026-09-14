import { moveToTrash } from "@oses/automation";
import { getConversationDetail, updateConversation } from "@oses/messaging";
import { updateConversationSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ conversation: await getConversationDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "") }));

export const PATCH = withApi(
  async (ctx) => {
    await updateConversation(ctx.db, serviceContext(ctx), ctx.params.id ?? "", ctx.body);
    return { conversation: await getConversationDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "") };
  },
  { body: updateConversationSchema },
);

export const DELETE = withApi(async (ctx) => {
  await moveToTrash(ctx.db, serviceContext(ctx), "CONVERSATION", ctx.params.id ?? "");
  return { ok: true };
});
