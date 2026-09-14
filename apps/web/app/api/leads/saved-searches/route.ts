import { createSavedSearch, listSavedSearches } from "@oses/discovery";
import { savedSearchSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ items: await listSavedSearches(ctx.db, serviceContext(ctx)) }));

export const POST = withApi(async (ctx) => ({ savedSearch: await createSavedSearch(ctx.db, serviceContext(ctx), ctx.body) }), { body: savedSearchSchema });
