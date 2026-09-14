import { db } from "@oses/database";
import { withApi } from "@/lib/server/api";
import { getMetrics, resolveRange } from "@/lib/server/analytics";

export const GET = withApi(async ({ organizationId, query }) => {
  const range = resolveRange(query.get("range") ?? "month");
  const [metrics, recentActivity, upcoming, attention, recentSearches] = await Promise.all([
    getMetrics(organizationId, range),
    db.activity.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 10, include: { client: { select: { id: true, cid: true, brandName: true } } } }),
    db.scheduledMessage.findMany({ where: { organizationId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, orderBy: { scheduledAt: "asc" }, take: 6, include: { client: { select: { id: true, cid: true, brandName: true } } } }),
    db.conversation.findMany({ where: { organizationId, deletedAt: null, OR: [{ needsHumanReview: true }, { aiStatus: "suggestion_ready" }] }, orderBy: { updatedAt: "desc" }, take: 6, include: { client: { select: { id: true, cid: true, brandName: true } } } }),
    db.searchRun.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" }, take: 5, select: { id: true, query: true, status: true, totalNew: true, totalDeduped: true, createdAt: true } }),
  ]);
  return {
    range: { from: range.from.toISOString(), to: range.to.toISOString(), preset: range.preset },
    metrics,
    recentActivity: recentActivity.map((a) => ({ id: a.id, type: a.type, title: a.title, description: a.description, actorType: a.actorType, createdAt: a.createdAt, client: a.client })),
    upcoming: upcoming.map((s) => ({ id: s.id, scheduledAt: s.scheduledAt, timezone: s.timezone, status: s.status, channel: s.channel, client: s.client, preview: s.body.slice(0, 120) })),
    attention: attention.map((c) => ({ id: c.id, client: c.client, reason: c.needsHumanReason ?? (c.aiStatus === "suggestion_ready" ? "AI suggestion ready for review" : "Needs attention"), aiStatus: c.aiStatus, channel: c.channel, updatedAt: c.updatedAt })),
    recentSearches,
  };
});
