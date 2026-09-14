import { changeCampaignStatus, getJobQueue } from "@oses/automation";
import { campaignActionSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";
import { kickInlineRunner } from "@/lib/server/jobs";

export const POST = withApi(
  async (ctx) => {
    const campaign = await changeCampaignStatus(ctx.db, serviceContext(ctx), getJobQueue(ctx.db), ctx.params.id ?? "", ctx.body.action);
    if (campaign.status === "RUNNING") kickInlineRunner();
    return { campaign };
  },
  { body: campaignActionSchema },
);
