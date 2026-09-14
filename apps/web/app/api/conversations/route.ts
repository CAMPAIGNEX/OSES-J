import { listConversations } from "@oses/messaging";
import { conversationListQuerySchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => listConversations(ctx.db, serviceContext(ctx), parseQuery(ctx.query, conversationListQuerySchema)));
