import { addTagToLeads } from "@oses/discovery";
import { z } from "zod";
import { serviceContext, withApi } from "@/lib/server/api";

const schema = z.object({ leadIds: z.array(z.string()).min(1).max(500), tag: z.string().trim().min(1).max(60) });

export const POST = withApi(
  async (ctx) => {
    await addTagToLeads(ctx.db, serviceContext(ctx), ctx.body.leadIds, ctx.body.tag);
    return { ok: true };
  },
  { body: schema },
);
