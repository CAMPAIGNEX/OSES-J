import { moveToTrash } from "@oses/automation";
import { getClientByCid, updateClient } from "@oses/crm";
import { updateClientSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ client: await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "") }));

export const PATCH = withApi(
  async (ctx) => {
    await updateClient(ctx.db, serviceContext(ctx), ctx.params.cid ?? "", ctx.body);
    return { client: await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "") };
  },
  { body: updateClientSchema },
);

export const DELETE = withApi(async (ctx) => {
  const client = await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "");
  await moveToTrash(ctx.db, serviceContext(ctx), "CLIENT", client.id);
  return { ok: true };
});
