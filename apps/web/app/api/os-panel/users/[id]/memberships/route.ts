import { ConflictError, NotFoundError } from "@oses/shared";
import { osMembershipSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

/** Add the user to a workspace (support onboarding) or change their role. */
export const POST = withApi(
  async (ctx) => {
    const userId = ctx.params.id ?? "";
    const [user, organization] = await Promise.all([ctx.db.user.findUnique({ where: { id: userId }, select: { email: true } }), ctx.db.organization.findFirst({ where: { id: ctx.body.organizationId, deletedAt: null }, select: { id: true, name: true } })]);
    if (!user) throw new NotFoundError("User");
    if (!organization) throw new NotFoundError("Organization");
    const existing = await ctx.db.organizationMember.findFirst({ where: { userId, organizationId: organization.id } });
    const membership = existing ? await ctx.db.organizationMember.update({ where: { id: existing.id }, data: { role: ctx.body.role } }) : await ctx.db.organizationMember.create({ data: { userId, organizationId: organization.id, role: ctx.body.role } });
    await osAudit(ctx, { action: existing ? "os.membership_role_changed" : "os.membership_added", organizationId: organization.id, entityType: "OrganizationMember", entityId: membership.id, meta: { email: user.email, role: ctx.body.role } });
    return { membership };
  },
  { superAdminOnly: true, body: osMembershipSchema },
);

export const DELETE = withApi(
  async (ctx) => {
    const userId = ctx.params.id ?? "";
    const organizationId = ctx.query.get("organizationId") ?? "";
    const membership = await ctx.db.organizationMember.findFirst({ where: { userId, organizationId }, include: { user: { select: { email: true } } } });
    if (!membership) throw new NotFoundError("Membership");
    const owners = await ctx.db.organizationMember.count({ where: { organizationId, role: "OWNER" } });
    if (membership.role === "OWNER" && owners <= 1) throw new ConflictError("This user is the only owner of the workspace; assign another owner first.");
    await ctx.db.organizationMember.delete({ where: { id: membership.id } });
    await ctx.db.session.updateMany({ where: { userId, activeOrganizationId: organizationId }, data: { activeOrganizationId: null } });
    await osAudit(ctx, { action: "os.membership_removed", organizationId, entityType: "OrganizationMember", entityId: membership.id, meta: { email: membership.user.email } });
    return { ok: true };
  },
  { superAdminOnly: true },
);
