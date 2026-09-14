import { cancelScheduledMessage } from "@oses/messaging";
import { serviceContext, withApi } from "@/lib/server/api";

export const DELETE = withApi(async (ctx) => {
  await cancelScheduledMessage(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
  return { ok: true };
});
