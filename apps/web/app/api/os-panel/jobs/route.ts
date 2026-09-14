import type { Prisma } from "@oses/database";
import { osListQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";
import { pageResult, paging } from "@/lib/server/os-panel";

const STATUSES = new Set(["QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]);

export const GET = withApi(
  async ({ db, query }) => {
    const q = parseQuery(query, osListQuerySchema);
    const where: Prisma.AutomationJobWhereInput = {};
    if (q.status && STATUSES.has(q.status)) where.status = q.status as never;
    if (q.type) where.type = q.type as never;
    if (q.organizationId) where.organizationId = q.organizationId;
    if (q.q) where.OR = [{ error: { contains: q.q } }, { id: { contains: q.q } }, { organization: { name: { contains: q.q } } }];
    const [items, total, byStatus] = await Promise.all([
      db.automationJob.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }],
        ...paging(q.page, q.pageSize),
        select: { id: true, type: true, status: true, attempts: true, maxAttempts: true, scheduledAt: true, startedAt: true, completedAt: true, error: true, errorClass: true, lockedBy: true, entityType: true, entityId: true, createdAt: true, updatedAt: true, organizationId: true, organization: { select: { name: true } } },
      }),
      db.automationJob.count({ where }),
      db.automationJob.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);
    return { ...pageResult(items, total, q.page, q.pageSize), byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })) };
  },
  { superAdminOnly: true },
);
