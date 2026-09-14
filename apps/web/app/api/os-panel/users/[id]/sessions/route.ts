import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";

/** Sign the user out everywhere. */
export const DELETE = withApi(
  async (ctx) => {
    const id = ctx.params.id ?? "";
    const user = await ctx.db.user.findUnique({ where: { id }, select: { email: true } });
    if (!user) throw new NotFoundError("User");
    const { count } = await ctx.db.session.deleteMany({ where: { userId: id } });
    await osAudit(ctx, { action: "os.user_sessions_revoked", entityType: "User", entityId: id, meta: { email: user.email, sessions: count } });
    return { revoked: count };
  },
  { superAdminOnly: true },
);
