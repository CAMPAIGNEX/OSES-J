import { withApi } from "@/lib/server/api";

/** Platform-wide counters for the OS-Panel overview. */
export const GET = withApi(
  async ({ db }) => {
    const now = Date.now();
    const dayAgo = new Date(now - 86_400_000);
    const weekAgo = new Date(now - 7 * 86_400_000);
    const [organizations, suspended, users, activeUsers, leads, clients, messages24h, messages7d, replies7d, jobsQueued, jobsRunning, jobsFailed, aiActions24h, devicesOnline, recentOrganizations, recentFailedJobs, signups7d] = await Promise.all([
      db.organization.count({ where: { deletedAt: null } }),
      db.organization.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
      db.user.count(),
      db.user.count({ where: { isActive: true, lastLoginAt: { gte: weekAgo } } }),
      db.lead.count({ where: { deletedAt: null } }),
      db.client.count({ where: { deletedAt: null } }),
      db.message.count({ where: { direction: "OUTBOUND", createdAt: { gte: dayAgo } } }),
      db.message.count({ where: { direction: "OUTBOUND", createdAt: { gte: weekAgo } } }),
      db.message.count({ where: { direction: "INBOUND", createdAt: { gte: weekAgo } } }),
      db.automationJob.count({ where: { status: "QUEUED" } }),
      db.automationJob.count({ where: { status: "RUNNING" } }),
      db.automationJob.count({ where: { status: "FAILED", updatedAt: { gte: weekAgo } } }),
      db.aIActionLog.count({ where: { createdAt: { gte: dayAgo } } }),
      db.extensionDevice.count({ where: { status: "ONLINE", lastSeenAt: { gte: new Date(now - 2 * 60_000) } } }),
      db.organization.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, slug: true, status: true, plan: true, createdAt: true, _count: { select: { members: true, clients: true } } } }),
      db.automationJob.findMany({ where: { status: "FAILED" }, orderBy: { updatedAt: "desc" }, take: 6, select: { id: true, type: true, error: true, errorClass: true, organizationId: true, updatedAt: true, organization: { select: { name: true } } } }),
      db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    ]);
    return {
      counters: { organizations, suspended, users, activeUsers, signups7d, leads, clients, messages24h, messages7d, replies7d, jobsQueued, jobsRunning, jobsFailed, aiActions24h, devicesOnline },
      recentOrganizations,
      recentFailedJobs,
    };
  },
  { superAdminOnly: true },
);
