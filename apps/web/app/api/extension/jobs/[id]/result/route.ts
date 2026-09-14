import { authenticateDevice, reportResult } from "@oses/messaging";
import { extensionResultSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

export const POST = withExtensionApi(
  async (ctx) => {
    const device = await authenticateDevice(ctx.db, ctx.token);
    const job = await reportResult(ctx.db, device, ctx.params.id ?? "", ctx.body);
    return { ok: true, status: job.status };
  },
  { body: extensionResultSchema },
);
