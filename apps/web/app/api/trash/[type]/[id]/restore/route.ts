import { restoreFromTrash } from "@oses/automation";
import type { TrashEntityType } from "@oses/database";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => {
  await restoreFromTrash(ctx.db, serviceContext(ctx), (ctx.params.type ?? "").toUpperCase() as TrashEntityType, ctx.params.id ?? "");
  return { ok: true };
});
