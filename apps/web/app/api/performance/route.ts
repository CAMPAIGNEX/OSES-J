import { withApi } from "@/lib/server/api";
import { getMetrics, getTimeseries, resolveRange } from "@/lib/server/analytics";

export const GET = withApi(async (ctx) => {
  const range = resolveRange(ctx.query.get("range"), ctx.query.get("from"), ctx.query.get("to"));
  const [metrics, series] = await Promise.all([getMetrics(ctx.organizationId, range), getTimeseries(ctx.organizationId, range)]);
  return { range: { from: range.from.toISOString(), to: range.to.toISOString(), preset: range.preset }, metrics, series };
});
