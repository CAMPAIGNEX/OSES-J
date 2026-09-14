import { refreshDeviceTokens } from "@oses/messaging";
import { extensionRefreshSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

export const POST = withExtensionApi(
  async (ctx) => {
    const { device, tokens } = await refreshDeviceTokens(ctx.db, ctx.body.refreshToken);
    return { deviceId: device.id, ...tokens };
  },
  { body: extensionRefreshSchema, rateLimit: { key: "ext-refresh", limit: 30, windowMs: 60_000 } },
);
