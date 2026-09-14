"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, CalendarClock, Inbox, MessageSquare, Search, Sparkles, UserPlus, Users, Eye, Reply, Megaphone, AlertCircle, Bookmark } from "lucide-react";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatNumber, timeAgo, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton, StatusBadge, cn } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/data";
import { Tabs } from "@/components/ui/overlay";

interface Summary {
  metrics: Record<string, number> & { channelActivity: Array<{ channel: string; sent: number; replies: number }> };
  recentActivity: Array<{ id: string; type: string; title: string; description: string | null; actorType: string; createdAt: string; client: { id: string; cid: string; brandName: string } | null }>;
  upcoming: Array<{ id: string; scheduledAt: string; timezone: string; status: string; channel: string; client: { cid: string; brandName: string }; preview: string }>;
  attention: Array<{ id: string; client: { cid: string; brandName: string }; reason: string; aiStatus: string; channel: string; updatedAt: string }>;
  recentSearches: Array<{ id: string; query: string; status: string; totalNew: number; totalDeduped: number; createdAt: string }>;
}

type Range = "today" | "week" | "month";

export function DashboardView() {
  const [range, setRange] = useState<Range>("week");
  const { data, loading } = useQuery<Summary>(`/api/dashboard/summary?range=${range}`, { refreshInterval: 30_000 });
  const m = data?.metrics;
  const stat = (label: string, key: string, opts: { href?: string; icon?: React.ReactNode; hint?: string; tone?: "neutral" | "brand" | "success" | "warning" | "danger"; suffix?: string } = {}) => (
    <StatCard label={label} value={m ? `${formatNumber(m[key])}${opts.suffix ?? ""}` : "—"} loading={loading && !data} href={opts.href} icon={opts.icon} hint={opts.hint} tone={opts.tone} />
  );

  return (
    <div className="animate-in">
      <PageHeader
        title="Dashboard"
        description="Your export sales activity at a glance."
        actions={
          <div className="flex items-center gap-2">
            <Tabs value={range} onChange={setRange} items={[{ value: "today", label: "Today" }, { value: "week", label: "This week" }, { value: "month", label: "This month" }]} className="border-0" />
            <Button href="/leads/search" icon={<Search className="h-4 w-4" />}>
              Search leads
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stat("Leads discovered", "leadsDiscovered", { href: "/leads/saved?saved=false", icon: <Search className="h-4 w-4" />, tone: "brand" })}
        {stat("Leads saved", "leadsSaved", { href: "/leads/saved", icon: <Bookmark className="h-4 w-4" /> })}
        {stat("Clients added", "clientsAdded", { href: "/clients", icon: <UserPlus className="h-4 w-4" />, hint: m ? `${formatNumber(m.totalClients)} total` : undefined })}
        {stat("Messages sent", "messagesSent", { href: "/inbox", icon: <MessageSquare className="h-4 w-4" /> })}
        {stat("Replies", "replies", { href: "/inbox?unread=true", icon: <Reply className="h-4 w-4" />, tone: "success", hint: m ? `${m.replyRate}% reply rate` : undefined })}
        {stat("Interested", "interestedLeads", { href: "/clients?status=INTERESTED", icon: <Sparkles className="h-4 w-4" />, tone: "success" })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stat("Delivered", "messagesDelivered", { icon: <MessageSquare className="h-4 w-4" />, hint: "where the channel reports it" })}
        {stat("Seen", "messagesSeen", { icon: <Eye className="h-4 w-4" />, hint: m ? `${m.seenRate}% of sent` : undefined })}
        {stat("Follow-ups due", "followUpsDue", { href: "/inbox", icon: <CalendarClock className="h-4 w-4" />, tone: "warning", hint: "next 24 hours" })}
        {stat("Active campaigns", "activeCampaigns", { href: "/campaigns", icon: <Megaphone className="h-4 w-4" /> })}
        {stat("AI actions", "aiActions", { href: "/ai-assistant?tab=activity", icon: <Bot className="h-4 w-4" />, tone: "brand" })}
        {stat("Needs attention", "pendingApprovals", { href: "/inbox?aiStatus=suggestion_ready", icon: <AlertCircle className="h-4 w-4" />, tone: "warning", hint: m ? `${m.needsHumanReview} need human review` : undefined })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="AI tasks requiring attention" description="Suggestions waiting for approval and conversations escalated to a human." actions={<Button variant="outline" size="sm" href="/inbox?aiStatus=suggestion_ready">Open inbox</Button>} />
          {loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : data?.attention.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {data.attention.map((a) => (
                <li key={a.id}>
                  <Link href={`/inbox/${a.id}`} className="flex items-center gap-3 py-2.5 hover:bg-surface-2/60 -mx-2 px-2 rounded-lg">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-900/30"><Bot className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{a.client.brandName} <span className="text-faint">· {a.client.cid}</span></span>
                      <span className="block truncate text-xs text-muted">{a.reason}</span>
                    </span>
                    <Badge tone={a.aiStatus === "suggestion_ready" ? "brand" : "warning"}>{a.aiStatus === "suggestion_ready" ? "Suggestion ready" : "Human review"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Bot className="h-5 w-5" />} title="Nothing waiting on you" description="AI suggestions and escalations will appear here." />
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming follow-ups" actions={<Button variant="ghost" size="sm" href="/inbox">All</Button>} />
          {loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : data?.upcoming.length ? (
            <ul className="space-y-3">
              {data.upcoming.map((u) => (
                <li key={u.id} className="flex items-start gap-3">
                  <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-faint" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{u.client.brandName}</p>
                    <p className="text-xs text-muted">{formatDateTime(u.scheduledAt)} <span className="text-faint">· {u.timezone}</span></p>
                  </div>
                  <StatusBadge status={u.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-[13px] text-muted">No scheduled messages.</p>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recent activity" />
          {loading && !data ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
          ) : data?.recentActivity.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", a.actorType === "AI" ? "bg-brand-50 text-brand-600 dark:bg-brand-900/40" : "bg-surface-2 text-muted")}>{a.actorType === "AI" ? <Bot className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">
                      {a.client ? (
                        <Link href={`/clients/${a.client.cid}`} className="font-medium hover:underline">
                          {a.client.brandName}
                        </Link>
                      ) : null}{" "}
                      <span className="text-muted">{a.title}</span>
                    </p>
                    {a.description && <p className="truncate text-xs text-faint">{a.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-faint">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<Inbox className="h-5 w-5" />} title="No activity yet" description="Search for leads, add clients and start conversations to see activity here." action={<Button href="/leads/search" size="sm">Search leads</Button>} />
          )}
        </Card>

        <Card>
          <CardHeader title="Channel activity" />
          <ul className="space-y-3">
            {(m?.channelActivity ?? [{ channel: "INSTAGRAM", sent: 0, replies: 0 }, { channel: "FACEBOOK", sent: 0, replies: 0 }]).map((c) => (
              <li key={c.channel} className="flex items-center justify-between text-[13px]">
                <span className="font-medium">{titleCase(c.channel)}</span>
                <span className="text-muted tabular">{c.sent} sent · {c.replies} replies</span>
              </li>
            ))}
          </ul>
          <div className="mt-5 border-t border-default pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Recent searches</p>
            {data?.recentSearches.length ? (
              <ul className="space-y-2">
                {data.recentSearches.map((s) => (
                  <li key={s.id}>
                    <Link href={`/leads/search/${s.id}`} className="flex items-center justify-between gap-2 text-[13px] hover:underline">
                      <span className="truncate">{s.query}</span>
                      <span className="shrink-0 text-xs text-faint">{s.totalNew} new</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No searches yet.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
