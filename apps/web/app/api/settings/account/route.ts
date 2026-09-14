import { writeAudit } from "@oses/database";
import { updateAccountSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const PUT = withApi(
  async (ctx) => {
    const user = await ctx.db.user.update({ where: { id: ctx.userId }, data: { ...(ctx.body.name ? { name: ctx.body.name } : {}), ...(ctx.body.timezone !== undefined ? { timezone: ctx.body.timezone || null } : {}) }, select: { id: true, name: true, email: true, timezone: true } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "account.updated" });
    return { user };
  },
  { body: updateAccountSchema },
);
