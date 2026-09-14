import { analyzeLead } from "@oses/ai";
import { loadClientWithRelations, toClientProfile } from "@oses/automation";
import { getClientByCid } from "@oses/crm";
import { serviceContext, withApi } from "@/lib/server/api";

/** AI lead analysis (fit score, talking points, risks). Stored on the client and logged. */
export const POST = withApi(async (ctx) => {
  const client = await getClientByCid(ctx.db, serviceContext(ctx), ctx.params.cid ?? "");
  const full = await loadClientWithRelations(ctx.db, ctx.organizationId, client.id);
  if (!full) return { analysis: null };
  const outcome = await analyzeLead({ db: ctx.db, organizationId: ctx.organizationId, triggeredBy: "USER", userId: ctx.userId, clientId: client.id }, toClientProfile(full));
  await ctx.db.client.update({ where: { id: client.id }, data: { aiSummary: outcome.result.summary, aiAnalysis: outcome.result as unknown as object } });
  await ctx.db.activity.create({ data: { organizationId: ctx.organizationId, clientId: client.id, type: "ai.analysis", title: `AI analysed this client (fit ${outcome.result.fitScore}/100)`, actorType: "AI", userId: ctx.userId } });
  return { analysis: outcome.result, actionLogId: outcome.actionLogId };
});
