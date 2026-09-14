import { hashPassword, NotFoundError, ValidationError } from "@oses/shared";
import { osUserUpdateSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

export const GET = withApi(
  async ({ db, params }) => {
    const user = await db.user.findUnique({
      where: { id: params.id ?? "" },
      select: {
        id: true,
        email: true,
        name: true,
        timezone: true,
        isActive: true,
        isSuperAdmin: true,
        lastLoginAt: true,
        createdAt: true,
        memberships: { select: { id: true, role: true, createdAt: true, organization: { select: { id: true, name: true, slug: true, status: true, plan: true } } } },
        sessions: { select: { id: true, ip: true, userAgent: true, lastSeenAt: true, expiresAt: true, createdAt: true }, orderBy: { lastSeenAt: "desc" }, take: 10 },
        devices: { select: { id: true, name: true, status: true, lastSeenAt: true, organizationId: true } },
      },
    });
    if (!user) throw new NotFoundError("User");
    const recentAudit = await db.auditLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, organizationId: true, createdAt: true, ip: true, meta: true } });
    return { user, recentAudit };
  },
  { superAdminOnly: true },
);

export const PATCH = withApi(
  async (ctx) => {
    const id = ctx.params.id ?? "";
    const user = await ctx.db.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError("User");
    const b = ctx.body;
    if (id === ctx.session.user.id && (b.isSuperAdmin === false || b.isActive === false)) throw new ValidationError("You cannot remove your own operator access or deactivate yourself");
    const data: Record<string, unknown> = {};
    if (b.name !== undefined) data.name = b.name;
    if (b.isActive !== undefined) data.isActive = b.isActive;
    if (b.isSuperAdmin !== undefined) data.isSuperAdmin = b.isSuperAdmin;
    if (b.newPassword !== undefined) data.passwordHash = await hashPassword(b.newPassword);
    const updated = await ctx.db.user.update({ where: { id }, data, select: { id: true, email: true, name: true, isActive: true, isSuperAdmin: true } });
    if (b.isActive === false || b.newPassword !== undefined) await ctx.db.session.deleteMany({ where: { userId: id } });
    const action = b.newPassword ? "os.user_password_reset" : b.isSuperAdmin !== undefined ? (b.isSuperAdmin ? "os.operator_granted" : "os.operator_revoked") : b.isActive !== undefined ? (b.isActive ? "os.user_activated" : "os.user_deactivated") : "os.user_updated";
    await osAudit(ctx, { action, entityType: "User", entityId: id, meta: { email: user.email, fields: Object.keys(data) } });
    return { user: updated };
  },
  { superAdminOnly: true, body: osUserUpdateSchema },
);
