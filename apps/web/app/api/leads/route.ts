import { listLeads } from "@oses/discovery";
import { leadListQuerySchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const q = parseQuery(ctx.query, leadListQuerySchema);
  return listLeads(ctx.db, serviceContext(ctx), q);
});
