import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const search = await ctx.db.trendSearch.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId, deletedAt: null }, include: { items: { orderBy: [{ likes: "desc" }], take: 300 } } });
  if (!search) throw new NotFoundError("Trend search");
  return { search };
});
