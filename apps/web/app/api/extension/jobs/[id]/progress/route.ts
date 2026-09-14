import { authenticateDevice, reportProgress } from "@oses/messaging";
import { extensionProgressSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

export const POST = withExtensionApi(
  async (ctx) => {
    const device = await authenticateDevice(ctx.db, ctx.token);
    await reportProgress(ctx.db, device, ctx.params.id ?? "", ctx.body.status, ctx.body.detail);
    return { ok: true };
  },
  { body: extensionProgressSchema },
);
