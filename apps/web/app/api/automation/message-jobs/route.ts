import { messageJobListQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const q = parseQuery(ctx.query, messageJobListQuerySchema);
  const where = { organizationId: ctx.organizationId, ...(q.status ? { status: q.status as never } : {}), ...(q.provider ? { provider: q.provider as never } : {}) };
  const [total, items] = await Promise.all([
    ctx.db.messageJob.count({ where }),
    ctx.db.messageJob.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { client: { select: { cid: true, brandName: true } }, message: { select: { body: true, channel: true } } } }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
});
