import { listTags } from "@oses/crm";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ items: await listTags(ctx.db, ctx.organizationId) }));
