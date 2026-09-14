import { authenticateDevice, heartbeat } from "@oses/messaging";
import { extensionHeartbeatSchema } from "@oses/validation";
import { withExtensionApi } from "@/lib/server/api";

export const POST = withExtensionApi(
  async (ctx) => {
    const device = await authenticateDevice(ctx.db, ctx.token);
    await heartbeat(ctx.db, device, { status: ctx.body.status, capabilities: ctx.body.capabilities, extensionVersion: ctx.body.extensionVersion, currentJobId: ctx.body.currentJobId });
    const settings = await ctx.db.organizationSettings.findUnique({ where: { organizationId: device.organizationId }, select: { extensionEnabled: true } });
    return { ok: true, deviceId: device.id, extensionEnabled: settings?.extensionEnabled ?? true };
  },
  { body: extensionHeartbeatSchema },
);
