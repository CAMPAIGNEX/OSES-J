import { trashLeads } from "@oses/discovery";
import { leadIdsSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => ({ count: await trashLeads(ctx.db, serviceContext(ctx), ctx.body.leadIds) }), { body: leadIdsSchema });
