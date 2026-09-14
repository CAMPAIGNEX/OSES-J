import { addLeadsToBusiness } from "@oses/crm";
import { addToBusinessSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

/** Converts saved leads into clients with permanent CIDs; never creates duplicates. */
export const POST = withApi(async (ctx) => addLeadsToBusiness(ctx.db, serviceContext(ctx), ctx.body.leadIds), { body: addToBusinessSchema });
