import { pairDevice } from "@oses/messaging";
import { extensionAuthSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

/** Extension: exchange the pairing code for device tokens (no OSES J password ever reaches the extension). */
export const POST = withExtensionApi(
  async (ctx) => {
    const { device, tokens } = await pairDevice(ctx.db, ctx.body);
    return { deviceId: device.id, organizationId: device.organizationId, ...tokens };
  },
  { body: extensionAuthSchema, rateLimit: { key: "ext-auth", limit: 10, windowMs: 60_000 } },
);
