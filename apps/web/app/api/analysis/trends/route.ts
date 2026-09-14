import { createTrendSearch, getJobQueue } from "@oses/automation";
import { analysisListQuerySchema, trendSearchSchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";
import { kickInlineRunner } from "@/lib/server/jobs";

export const GET = withApi(async (ctx) => {
  const q = parseQuery(ctx.query, analysisListQuerySchema);
  const where = { organizationId: ctx.organizationId, deletedAt: null };
  const [total, items] = await Promise.all([ctx.db.trendSearch.count({ where }), ctx.db.trendSearch.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: { id: true, name: true, status: true, itemCount: true, createdAt: true, criteria: true, error: true } })]);
  return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
});

export const POST = withApi(
  async (ctx) => {
    const row = await createTrendSearch(ctx.db, serviceContext(ctx), getJobQueue(ctx.db), ctx.body);
    kickInlineRunner();
    return { search: row };
  },
  { body: trendSearchSchema },
);
