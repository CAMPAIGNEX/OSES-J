import "server-only";
import { db, Prisma } from "@oses/database";
import { addDays, startOfUtcDay } from "@oses/shared";

export type RangePreset = "today" | "week" | "month" | "3m" | "6m" | "1y" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
  preset: RangePreset;
}

export function resolveRange(preset: string | null | undefined, from?: string | null, to?: string | null): DateRange {
  const now = new Date();
  const end = new Date(now.getTime() + 60_000);
  const p = (preset as RangePreset) || "month";
  switch (p) {
    case "today":
      return { from: startOfUtcDay(now), to: end, preset: p };
    case "week":
      return { from: addDays(startOfUtcDay(now), -6), to: end, preset: p };
    case "3m":
      return { from: addDays(startOfUtcDay(now), -90), to: end, preset: p };
    case "6m":
      return { from: addDays(startOfUtcDay(now), -180), to: end, preset: p };
    case "1y":
      return { from: addDays(startOfUtcDay(now), -365), to: end, preset: p };
    case "custom": {
      const f = from ? new Date(from) : addDays(startOfUtcDay(now), -29);
      const t = to ? new Date(to) : end;
      return { from: Number.isNaN(f.getTime()) ? addDays(startOfUtcDay(now), -29) : f, to: Number.isNaN(t.getTime()) ? end : t, preset: p };
    }
    default:
      return { from: addDays(startOfUtcDay(now), -29), to: end, preset: "month" };
  }
}

export interface Metrics {
  leadsDiscovered: number;
  leadsSaved: number;
  clientsAdded: number;
  totalClients: number;
  messagesSent: number;
  messagesDelivered: number;
  messagesSeen: number;
  replies: number;
  conversationsContacted: number;
  conversationsReplied: number;
  replyRate: number;
  seenRate: number;
  interestedLeads: number;
  conversions: number;
  followUpsDue: number;
  followUpsSent: number;
  activeCampaigns: number;
  aiActions: number;
  pendingApprovals: number;
  needsHumanReview: number;
  channelActivity: Array<{ channel: string; sent: number; replies: number }>;
}

export async function getMetrics(organizationId: string, range: DateRange): Promise<Metrics> {
  const inRange = { gte: range.from, lte: range.to };
  const outbound = { organizationId, direction: "OUTBOUND" as const };
  const sentStatuses = ["SENT", "DELIVERED", "SEEN"] as const;
  const [leadsDiscovered, leadsSaved, clientsAdded, totalClients, messagesSent, messagesDelivered, messagesSeen, replies, contactedConvs, repliedConvs, interestedLeads, conversions, followUpsDue, followUpsSent, activeCampaigns, aiActions, pendingApprovals, needsHumanReview, byChannelSent, byChannelReplies] = await Promise.all([
    db.lead.count({ where: { organizationId, createdAt: inRange } }),
    db.lead.count({ where: { organizationId, savedAt: inRange } }),
    db.client.count({ where: { organizationId, createdAt: inRange } }),
    db.client.count({ where: { organizationId, deletedAt: null } }),
    db.message.count({ where: { ...outbound, status: { in: [...sentStatuses] }, sentAt: inRange } }),
    db.message.count({ where: { ...outbound, deliveredAt: inRange } }),
    db.message.count({ where: { ...outbound, seenAt: inRange } }),
    db.message.count({ where: { organizationId, direction: "INBOUND", createdAt: inRange } }),
    db.conversation.count({ where: { organizationId, lastOutboundAt: inRange } }),
    db.conversation.count({ where: { organizationId, lastOutboundAt: inRange, lastInboundAt: { not: null } } }),
    db.client.count({ where: { organizationId, deletedAt: null, status: { in: ["INTERESTED", "NEGOTIATING"] }, lastActivityAt: inRange } }),
    db.client.count({ where: { organizationId, deletedAt: null, status: "CUSTOMER", updatedAt: inRange } }),
    db.scheduledMessage.count({ where: { organizationId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] }, scheduledAt: { lte: addDays(new Date(), 1) } } }),
    db.message.count({ where: { ...outbound, scheduledMessageId: { not: null }, sentAt: inRange } }),
    db.campaign.count({ where: { organizationId, status: "RUNNING", deletedAt: null } }),
    db.aIActionLog.count({ where: { organizationId, createdAt: inRange } }),
    db.message.count({ where: { organizationId, status: "PENDING_APPROVAL" } }),
    db.conversation.count({ where: { organizationId, needsHumanReview: true, deletedAt: null } }),
    db.message.groupBy({ by: ["channel"], where: { ...outbound, status: { in: [...sentStatuses] }, sentAt: inRange }, _count: { _all: true } }),
    db.message.groupBy({ by: ["channel"], where: { organizationId, direction: "INBOUND", createdAt: inRange }, _count: { _all: true } }),
  ]);
  const channels = new Map<string, { channel: string; sent: number; replies: number }>();
  for (const c of ["INSTAGRAM", "FACEBOOK"]) channels.set(c, { channel: c, sent: 0, replies: 0 });
  for (const r of byChannelSent) channels.get(r.channel)!.sent = r._count._all;
  for (const r of byChannelReplies) channels.get(r.channel)!.replies = r._count._all;
  return {
    leadsDiscovered,
    leadsSaved,
    clientsAdded,
    totalClients,
    messagesSent,
    messagesDelivered,
    messagesSeen,
    replies,
    conversationsContacted: contactedConvs,
    conversationsReplied: repliedConvs,
    replyRate: contactedConvs ? Math.round((repliedConvs / contactedConvs) * 100) : 0,
    seenRate: messagesSent ? Math.min(100, Math.round((messagesSeen / messagesSent) * 100)) : 0,
    interestedLeads,
    conversions,
    followUpsDue,
    followUpsSent,
    activeCampaigns,
    aiActions,
    pendingApprovals,
    needsHumanReview,
    channelActivity: [...channels.values()],
  };
}

export interface SeriesPoint {
  date: string;
  leads: number;
  clients: number;
  sent: number;
  replies: number;
}

/** Daily (or weekly for long ranges) time series for interactive charts. */
export async function getTimeseries(organizationId: string, range: DateRange): Promise<SeriesPoint[]> {
  const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86_400_000));
  const weekly = days > 120;
  const bucketExpr = weekly ? Prisma.sql`DATE(DATE_SUB(t.ts, INTERVAL WEEKDAY(t.ts) DAY))` : Prisma.sql`DATE(t.ts)`;
  const rows = await db.$queryRaw<Array<{ bucket: Date | string; kind: string; n: bigint | number }>>`
    SELECT ${bucketExpr} AS bucket, t.kind AS kind, COUNT(*) AS n FROM (
      SELECT createdAt AS ts, 'leads' AS kind FROM leads WHERE organizationId = ${organizationId} AND createdAt BETWEEN ${range.from} AND ${range.to}
      UNION ALL SELECT createdAt AS ts, 'clients' AS kind FROM clients WHERE organizationId = ${organizationId} AND createdAt BETWEEN ${range.from} AND ${range.to}
      UNION ALL SELECT sentAt AS ts, 'sent' AS kind FROM messages WHERE organizationId = ${organizationId} AND direction = 'OUTBOUND' AND status IN ('SENT','DELIVERED','SEEN') AND sentAt BETWEEN ${range.from} AND ${range.to}
      UNION ALL SELECT createdAt AS ts, 'replies' AS kind FROM messages WHERE organizationId = ${organizationId} AND direction = 'INBOUND' AND createdAt BETWEEN ${range.from} AND ${range.to}
    ) t GROUP BY bucket, kind ORDER BY bucket`;
  const map = new Map<string, SeriesPoint>();
  // Pre-fill empty buckets so charts show continuous axes.
  for (let d = startOfUtcDay(range.from); d <= range.to; d = addDays(d, weekly ? 7 : 1)) {
    const key = weekly ? weekStart(d) : d.toISOString().slice(0, 10);
    if (!map.has(key)) map.set(key, { date: key, leads: 0, clients: 0, sent: 0, replies: 0 });
  }
  for (const r of rows) {
    const key = typeof r.bucket === "string" ? r.bucket.slice(0, 10) : new Date(r.bucket).toISOString().slice(0, 10);
    const point = map.get(key) ?? { date: key, leads: 0, clients: 0, sent: 0, replies: 0 };
    const n = Number(r.n);
    if (r.kind === "leads") point.leads = n;
    else if (r.kind === "clients") point.clients = n;
    else if (r.kind === "sent") point.sent = n;
    else if (r.kind === "replies") point.replies = n;
    map.set(key, point);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function weekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return addDays(d, -day).toISOString().slice(0, 10);
}
