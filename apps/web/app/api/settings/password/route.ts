import { writeAudit } from "@oses/database";
import { AuthError, hashPassword, verifyPassword } from "@oses/shared";
import { changePasswordSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const POST = withApi(
  async (ctx) => {
    const user = await ctx.db.user.findUniqueOrThrow({ where: { id: ctx.userId } });
    if (!(await verifyPassword(ctx.body.currentPassword, user.passwordHash))) throw new AuthError("Current password is incorrect");
    await ctx.db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(ctx.body.newPassword) } });
    await ctx.db.session.deleteMany({ where: { userId: user.id, NOT: { id: ctx.session.sessionId } } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "account.password_changed" });
    return { ok: true };
  },
  { body: changePasswordSchema, rateLimit: { key: "password", limit: 10, windowMs: 60_000 } },
);
