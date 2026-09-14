import { rejectMessage } from "@oses/messaging";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => ({ message: await rejectMessage(ctx.db, serviceContext(ctx), ctx.params.id ?? "") }));
