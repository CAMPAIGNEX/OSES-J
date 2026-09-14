import { approveMessage } from "@oses/messaging";
import { z } from "zod";
import { serviceContext, withApi } from "@/lib/server/api";
import { kickInlineRunner } from "@/lib/server/jobs";

export const POST = withApi(
  async (ctx) => {
    const result = await approveMessage(ctx.db, serviceContext(ctx), ctx.params.id ?? "", ctx.body.delivery);
    if (result.job) kickInlineRunner();
    return { message: result.message, send: result.send, openUrl: result.openUrl };
  },
  { body: z.object({ delivery: z.enum(["manual", "automation"]).default("automation") }) },
);
