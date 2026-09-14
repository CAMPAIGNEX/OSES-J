import { deleteSavedSearch } from "@oses/discovery";
import { serviceContext, withApi } from "@/lib/server/api";

export const DELETE = withApi(async (ctx) => {
  await deleteSavedSearch(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
  return { ok: true };
});
