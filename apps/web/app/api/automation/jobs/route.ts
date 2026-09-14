import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const status = ctx.query.get("status");
  const type = ctx.query.get("type");
  const take = Math.min(200, Number(ctx.query.get("take") ?? 50));
  const items = await ctx.db.automationJob.findMany({
    where: { organizationId: ctx.organizationId, ...(status ? { status: status as never } : {}), ...(type ? { type: type as never } : {}) },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, type: true, status: true, priority: true, attempts: true, maxAttempts: true, scheduledAt: true, startedAt: true, completedAt: true, error: true, errorClass: true, entityType: true, entityId: true, createdAt: true, result: true },
  });
  return { items };
});
