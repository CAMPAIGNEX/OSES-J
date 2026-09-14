import { setClientTags } from "@oses/crm";
import { tagsSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const PUT = withApi(
  async (ctx) => {
    await setClientTags(ctx.db, serviceContext(ctx), ctx.params.cid ?? "", ctx.body.tags);
    return { ok: true };
  },
  { body: tagsSchema },
);
