import { NotFoundError } from "@oses/shared";
import { osOrganizationUpdateSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

export const GET = withApi(
  async ({ db, params }) => {
    const id = params.id ?? "";
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const organization = await db.organization.findFirst({
      where: { id, deletedAt: null },
      include: {
        settings: { select: { messagingMode: true, autopilotEnabled: true, uiTemplate: true, extensionEnabled: true, apifyTokenEncrypted: true, aiProvider: true, aiApiKeyEncrypted: true, messagesPerDay: true, messagesPerHour: true } },
        members: { include: { user: { select: { id: true, email: true, name: true, isActive: true, isSuperAdmin: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { leads: true, clients: true, conversations: true, messages: true, campaigns: true, documents: true, extensionDevices: true, socialConnections: true } },
      },
    });
    if (!organization) throw new NotFoundError("Organization");
    const [usage, recentAudit, failedJobs, aiActions30d, searchRuns30d] = await Promise.all([
      db.usageRecord.groupBy({ by: ["metric"], where: { organizationId: id, day: { gte: monthAgo } }, _sum: { quantity: true } }),
      db.auditLog.findMany({ where: { organizationId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, actorType: true, createdAt: true, meta: true, user: { select: { email: true } } } }),
      db.automationJob.count({ where: { organizationId: id, status: "FAILED" } }),
      db.aIActionLog.count({ where: { organizationId: id, createdAt: { gte: monthAgo } } }),
      db.searchRun.count({ where: { organizationId: id, createdAt: { gte: monthAgo } } }),
    ]);
    const { settings, ...org } = organization;
    return {
      organization: { ...org, settings: settings ? { messagingMode: settings.messagingMode, autopilotEnabled: settings.autopilotEnabled, uiTemplate: settings.uiTemplate, extensionEnabled: settings.extensionEnabled, messagesPerDay: settings.messagesPerDay, messagesPerHour: settings.messagesPerHour, apifyConfigured: Boolean(settings.apifyTokenEncrypted), aiProvider: settings.aiProvider, aiKeyConfigured: Boolean(settings.aiApiKeyEncrypted) } : null },
      usage: usage.map((u) => ({ metric: u.metric, quantity: Number(u._sum?.quantity ?? 0) })),
      stats: { failedJobs, aiActions30d, searchRuns30d },
      recentAudit,
    };
  },
  { superAdminOnly: true },
);

export const PATCH = withApi(
  async (ctx) => {
    const id = ctx.params.id ?? "";
    const existing = await ctx.db.organization.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError("Organization");
    const b = ctx.body;
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = b.name;
    if (b.plan !== undefined) data.plan = b.plan;
    if (b.internalNotes !== undefined) data.internalNotes = b.internalNotes;
    if (b.status !== undefined) {
      data.status = b.status;
      data.suspendedAt = b.status === "SUSPENDED" ? new Date() : null;
      data.suspendedReason = b.status === "SUSPENDED" ? (b.suspendedReason ?? existing.suspendedReason ?? null) : null;
    } else if (b.suspendedReason !== undefined) {
      data.suspendedReason = b.suspendedReason;
    }
    const updated = await ctx.db.organization.update({ where: { id }, data });
    if (b.status === "SUSPENDED") {
      // Stop everything running for the workspace and sign its members out of automation-triggering flows.
      await ctx.db.organizationSettings.updateMany({ where: { organizationId: id }, data: { autopilotEnabled: false, messagingMode: "MANUAL" } });
      await ctx.db.campaign.updateMany({ where: { organizationId: id, status: "RUNNING" }, data: { status: "PAUSED" } });
      await ctx.db.automationJob.updateMany({ where: { organizationId: id, status: "QUEUED" }, data: { status: "CANCELLED" } });
    }
    await osAudit(ctx, { action: b.status ? (b.status === "SUSPENDED" ? "os.organization_suspended" : "os.organization_activated") : "os.organization_updated", organizationId: id, entityType: "Organization", entityId: id, meta: { fields: Object.keys(data), reason: b.suspendedReason ?? undefined } });
    return { organization: updated };
  },
  { superAdminOnly: true, body: osOrganizationUpdateSchema },
);

/** Soft-delete a workspace (members lose access; data kept for recovery by the platform team). */
export const DELETE = withApi(
  async (ctx) => {
    const id = ctx.params.id ?? "";
    const existing = await ctx.db.organization.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError("Organization");
    await ctx.db.organization.update({ where: { id }, data: { deletedAt: new Date(), status: "SUSPENDED", suspendedAt: new Date(), suspendedReason: "Deleted by platform team" } });
    await ctx.db.session.updateMany({ where: { activeOrganizationId: id }, data: { activeOrganizationId: null } });
    await ctx.db.automationJob.updateMany({ where: { organizationId: id, status: { in: ["QUEUED", "RUNNING"] } }, data: { status: "CANCELLED" } });
    await osAudit(ctx, { action: "os.organization_deleted", organizationId: id, entityType: "Organization", entityId: id, meta: { name: existing.name } });
    return { ok: true };
  },
  { superAdminOnly: true },
);
