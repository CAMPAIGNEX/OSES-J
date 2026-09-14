import { aiActionLogQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const q = parseQuery(ctx.query, aiActionLogQuerySchema);
  const where = { organizationId: ctx.organizationId, ...(q.clientId ? { clientId: q.clientId } : {}), ...(q.action ? { action: q.action as never } : {}), ...(q.status ? { status: q.status } : {}) };
  const [total, items] = await Promise.all([
    ctx.db.aIActionLog.count({ where }),
    ctx.db.aIActionLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { client: { select: { cid: true, brandName: true } } } }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
});
