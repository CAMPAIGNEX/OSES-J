import { authenticateDevice, claimNextJob } from "@oses/messaging";
import { extensionClaimSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

/** Extension: atomically claim the next queued browser-automation job for this organization. */
export const POST = withExtensionApi(
  async (ctx) => {
    const device = await authenticateDevice(ctx.db, ctx.token);
    const job = await claimNextJob(ctx.db, device, ctx.body.platforms);
    return { job };
  },
  { body: extensionClaimSchema },
);
