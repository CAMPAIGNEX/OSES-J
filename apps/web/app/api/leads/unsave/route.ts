import { setLeadsSaved } from "@oses/discovery";
import { leadIdsSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => ({ count: await setLeadsSaved(ctx.db, serviceContext(ctx), ctx.body.leadIds, false) }), { body: leadIdsSchema });
