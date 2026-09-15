"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, CardHeader, Input, Skeleton, cn } from "@/components/ui/primitives";
import { StatCard } from "@/components/ui/data";
import { FeatureGuide } from "@/components/layout/feature-guide";

interface Perf {
  range: { from: string; to: string; preset: string };
  metrics: Record<string, number> & { channelActivity: Array<{ channel: string; sent: number; replies: number }> };
  series: Array<{ date: string; leads: number; clients: number; sent: number; replies: number }>;
}

const PRESETS = [["today", "Today"], ["week", "This week"], ["month", "This month"], ["3m", "3 months"], ["6m", "6 months"], ["1y", "1 year"], ["custom", "Custom"]] as const;

export function PerformanceView() {
  const [preset, setPreset] = useState<string>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, loading } = useQuery<Perf>(`/api/performance${qs({ range: preset, from: preset === "custom" && from ? new Date(from).toISOString() : "", to: preset === "custom" && to ? new Date(to + "T23:59:59").toISOString() : "" })}`);
  const m = data?.metrics;
  const series = (data?.series ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" };
  return (
    <div className="animate-in">
      <PageHeader
        title="Performance"
        description="Sales activity and outcomes over time."
        actions={
          <div className="flex flex-wrap items-center gap-1">
            {PRESETS.map(([k, label]) => (
              <button key={k} type="button" onClick={() => setPreset(k)} className={cn("rounded-md px-2.5 py-1.5 text-[13px] font-medium", preset === k ? "bg-brand-500 text-white" : "text-muted hover:bg-surface-2")}>{label}</button>
            ))}
            {preset === "custom" && (
              <span className="flex items-center gap-1"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
      <FeatureGuide id="performance" /><span className="text-faint">–</span><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" /></span>
            )}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {[["Leads discovered", "leadsDiscovered"], ["Leads saved", "leadsSaved"], ["Clients added", "clientsAdded"], ["Messages sent", "messagesSent"], ["Delivered", "messagesDelivered"], ["Seen", "messagesSeen"], ["Replies", "replies"], ["Reply rate", "replyRate", "%"], ["Seen rate", "seenRate", "%"], ["Interested", "interestedLeads"], ["Follow-ups sent", "followUpsSent"], ["Conversions", "conversions"]].map(([label, key, suffix]) => (
          <StatCard key={key} label={label as string} value={m ? `${formatNumber(m[key as string])}${suffix ?? ""}` : "—"} loading={loading && !data} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Outreach & replies" description="Messages sent and replies received per day." />
          {loading && !data ? <Skeleton className="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="sent" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#007fff" stopOpacity={0.35} /><stop offset="100%" stopColor="#007fff" stopOpacity={0} /></linearGradient>
                    <linearGradient id="replies" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.35} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="sent" name="Sent" stroke="#007fff" fill="url(#sent)" strokeWidth={2} />
                  <Area type="monotone" dataKey="replies" name="Replies" stroke="#10b981" fill="url(#replies)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Pipeline growth" description="Leads discovered and clients added per day." />
          {loading && !data ? <Skeleton className="h-64" /> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={series} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--text-3)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="leads" name="Leads" fill="#a8ceff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="clients" name="Clients" fill="#007fff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Channel activity" />
          <div className="grid gap-3 sm:grid-cols-2">
            {(m?.channelActivity ?? []).map((c) => (
              <div key={c.channel} className="rounded-lg border border-default p-4">
                <p className="text-[13px] font-medium">{c.channel === "INSTAGRAM" ? "Instagram" : "Facebook"}</p>
                <p className="mt-1 text-2xl font-semibold tabular">{c.sent} <span className="text-sm font-normal text-muted">sent</span></p>
                <p className="text-[13px] text-muted">{c.replies} replies · {c.sent ? Math.round((c.replies / c.sent) * 100) : 0}% reply rate</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-faint">Delivered/seen counts only include channels that report status (official Meta API). Manual and extension sends show as sent.</p>
          <div className="mt-3"><Button size="sm" variant="outline" href="/inbox">Open inbox</Button></div>
        </Card>
      </div>
    </div>
  );
}
