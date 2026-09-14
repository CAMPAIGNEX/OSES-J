import { createCampaign, listCampaigns } from "@oses/automation";
import { campaignListQuerySchema, createCampaignSchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => listCampaigns(ctx.db, serviceContext(ctx), parseQuery(ctx.query, campaignListQuerySchema)));

export const POST = withApi(async (ctx) => ({ campaign: await createCampaign(ctx.db, serviceContext(ctx), ctx.body) }), { body: createCampaignSchema });
