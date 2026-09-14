import { getLeadDetail, updateLeadNotesAndTags } from "@oses/discovery";
import { updateLeadSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const lead = await getLeadDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
  return { lead };
});

export const PATCH = withApi(
  async (ctx) => {
    await updateLeadNotesAndTags(ctx.db, serviceContext(ctx), ctx.params.id ?? "", ctx.body);
    const lead = await getLeadDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "");
    return { lead };
  },
  { body: updateLeadSchema },
);
