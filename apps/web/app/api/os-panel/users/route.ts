import type { Prisma } from "@oses/database";
import { osListQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";
import { pageResult, paging } from "@/lib/server/os-panel";

export const GET = withApi(
  async ({ db, query }) => {
    const q = parseQuery(query, osListQuerySchema);
    const where: Prisma.UserWhereInput = {};
    if (q.q) where.OR = [{ email: { contains: q.q } }, { name: { contains: q.q } }, { memberships: { some: { organization: { name: { contains: q.q } } } } }];
    if (q.status === "active") where.isActive = true;
    if (q.status === "inactive") where.isActive = false;
    if (q.status === "operators") where.isSuperAdmin = true;
    if (q.organizationId) where.memberships = { some: { organizationId: q.organizationId } };
    const [items, total] = await Promise.all([
      db.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paging(q.page, q.pageSize),
        select: { id: true, email: true, name: true, isActive: true, isSuperAdmin: true, lastLoginAt: true, createdAt: true, memberships: { select: { role: true, organization: { select: { id: true, name: true, status: true } } } }, _count: { select: { sessions: true } } },
      }),
      db.user.count({ where }),
    ]);
    return pageResult(items, total, q.page, q.pageSize);
  },
  { superAdminOnly: true },
);
