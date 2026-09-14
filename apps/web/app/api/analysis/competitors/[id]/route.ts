import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const search = await ctx.db.competitorSearch.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId, deletedAt: null }, include: { items: { orderBy: [{ likes: "desc" }], take: 200 } } });
  if (!search) throw new NotFoundError("Competitor search");
  return { search };
});
