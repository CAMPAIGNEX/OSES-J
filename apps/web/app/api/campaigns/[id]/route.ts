import { getCampaignDetail, moveToTrash, updateCampaign } from "@oses/automation";
import { updateCampaignSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ campaign: await getCampaignDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "") }));

export const PATCH = withApi(
  async (ctx) => {
    await updateCampaign(ctx.db, serviceContext(ctx), ctx.params.id ?? "", ctx.body);
    return { campaign: await getCampaignDetail(ctx.db, serviceContext(ctx), ctx.params.id ?? "") };
  },
  { body: updateCampaignSchema },
);

export const DELETE = withApi(async (ctx) => {
  await moveToTrash(ctx.db, serviceContext(ctx), "CAMPAIGN", ctx.params.id ?? "");
  return { ok: true };
});
