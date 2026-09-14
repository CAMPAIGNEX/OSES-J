import { getOrCreateSettings, parseFollowUpDays, parseWorkingHours, writeAudit } from "@oses/database";
import { messagingSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

function view(s: Awaited<ReturnType<typeof getOrCreateSettings>>) {
  return { defaultChannel: s.defaultChannel, messagingMode: s.messagingMode, autopilotEnabled: s.autopilotEnabled, workingHours: parseWorkingHours(s.workingHours), followUpDays: parseFollowUpDays(s.followUpDays), messagesPerHour: s.messagesPerHour, messagesPerDay: s.messagesPerDay, minMinutesBetweenMessages: s.minMinutesBetweenMessages };
}

export const GET = withApi(async (ctx) => ({ settings: view(await getOrCreateSettings(ctx.db, ctx.organizationId)) }));

export const PUT = withApi(
  async (ctx) => {
    await getOrCreateSettings(ctx.db, ctx.organizationId);
    const b = ctx.body;
    const data: Record<string, unknown> = {};
    if (b.defaultChannel) data.defaultChannel = b.defaultChannel;
    if (b.messagingMode) {
      data.messagingMode = b.messagingMode;
      if (b.messagingMode !== "AUTOPILOT") data.autopilotEnabled = false;
    }
    if (b.workingHours) data.workingHours = b.workingHours;
    if (b.followUpDays) data.followUpDays = [...new Set(b.followUpDays)].sort((x, y) => x - y);
    if (b.messagesPerHour) data.messagesPerHour = b.messagesPerHour;
    if (b.messagesPerDay) data.messagesPerDay = b.messagesPerDay;
    if (b.minMinutesBetweenMessages !== undefined) data.minMinutesBetweenMessages = b.minMinutesBetweenMessages;
    const updated = await ctx.db.organizationSettings.update({ where: { organizationId: ctx.organizationId }, data });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.messaging_updated", meta: { fields: Object.keys(data) } });
    return { settings: view(updated) };
  },
  { body: messagingSettingsSchema, adminOnly: true },
);
