import { scheduleMessage } from "@oses/messaging";
import { scheduleMessageSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => ({ scheduled: await scheduleMessage(ctx.db, serviceContext(ctx), ctx.body) }), { body: scheduleMessageSchema });
