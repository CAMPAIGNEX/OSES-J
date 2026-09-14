import type { Prisma } from "@oses/database";
import { osListQuerySchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";
import { pageResult, paging } from "@/lib/server/os-panel";

export const GET = withApi(
  async ({ db, query }) => {
    const q = parseQuery(query, osListQuerySchema);
    const where: Prisma.OrganizationWhereInput = { deletedAt: null };
    if (q.q) where.OR = [{ name: { contains: q.q } }, { slug: { contains: q.q } }, { contactEmail: { contains: q.q } }, { members: { some: { user: { email: { contains: q.q } } } } }];
    if (q.status === "ACTIVE" || q.status === "SUSPENDED") where.status = q.status;
    const [items, total] = await Promise.all([
      db.organization.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...paging(q.page, q.pageSize),
        select: { id: true, name: true, slug: true, status: true, plan: true, country: true, city: true, createdAt: true, suspendedAt: true, _count: { select: { members: true, clients: true, leads: true, messages: true } }, settings: { select: { messagingMode: true, autopilotEnabled: true, uiTemplate: true } } },
      }),
      db.organization.count({ where }),
    ]);
    return pageResult(items, total, q.page, q.pageSize);
  },
  { superAdminOnly: true },
);
