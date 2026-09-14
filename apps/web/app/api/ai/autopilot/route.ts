import { getOrCreateSettings, writeAudit } from "@oses/database";
import { ValidationError } from "@oses/shared";
import { autopilotToggleSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

/** Turn AI Autopilot on/off. Enabling requires explicit confirmation from the UI dialog. */
export const POST = withApi(
  async (ctx) => {
    const { enabled, confirmed } = ctx.body;
    if (enabled && !confirmed) throw new ValidationError("Autopilot must be confirmed before it can be enabled", [{ path: "confirmed", message: "Confirmation required" }]);
    await getOrCreateSettings(ctx.db, ctx.organizationId);
    const settings = await ctx.db.organizationSettings.update({
      where: { organizationId: ctx.organizationId },
      data: enabled ? { autopilotEnabled: true, autopilotEnabledAt: new Date(), messagingMode: "AUTOPILOT" } : { autopilotEnabled: false, messagingMode: "COPILOT" },
    });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: enabled ? "ai.autopilot_enabled" : "ai.autopilot_disabled" });
    return { autopilotEnabled: settings.autopilotEnabled, messagingMode: settings.messagingMode };
  },
  { body: autopilotToggleSchema, adminOnly: true },
);
