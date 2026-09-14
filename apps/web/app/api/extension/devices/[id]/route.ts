import { revokeDevice } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

export const DELETE = withApi(async (ctx) => {
  await revokeDevice(ctx.db, ctx.organizationId, ctx.userId, ctx.params.id ?? "");
  return { ok: true };
});
