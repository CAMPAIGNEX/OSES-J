import type { Prisma } from "@oses/database";
import { osListQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";
import { pageResult, paging } from "@/lib/server/os-panel";

export const GET = withApi(
  async ({ db, query }) => {
    const q = parseQuery(query, osListQuerySchema);
    const where: Prisma.AuditLogWhereInput = {};
    if (q.organizationId) where.organizationId = q.organizationId;
    if (q.action) where.action = { startsWith: q.action };
    if (q.q) where.OR = [{ action: { contains: q.q } }, { user: { email: { contains: q.q } } }, { organization: { name: { contains: q.q } } }, { entityId: { contains: q.q } }];
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paging(q.page, q.pageSize),
        select: { id: true, action: true, actorType: true, entityType: true, entityId: true, ip: true, meta: true, createdAt: true, organizationId: true, organization: { select: { name: true } }, user: { select: { email: true, name: true } } },
      }),
      db.auditLog.count({ where }),
    ]);
    return pageResult(items, total, q.page, q.pageSize);
  },
  { superAdminOnly: true },
);
