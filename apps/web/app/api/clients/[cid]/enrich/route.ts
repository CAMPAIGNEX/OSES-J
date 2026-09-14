import { getClientByCid } from "@oses/crm";
import { enrichClientWebsite } from "@oses/enrichment";
import { serviceContext, withApi } from "@/lib/server/api";

/** Website contact extraction for a client (runs synchronously; single page fetch). */
export const POST = withApi(async (ctx) => {
  const client = await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "");
  const result = await enrichClientWebsite(ctx.db, ctx.organizationId, client.id);
  return { result: result ? { contacts: result.contacts.length, socialLinks: result.socialLinks.length, warnings: result.warnings } : null, client: await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "") };
});
