"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, ExternalLink, Sparkles, TrendingUp } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatCompact } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

type Kind = "competitors" | "trends";
interface Row { id: string; name: string | null; status: string; itemCount: number; createdAt: string; error: string | null; criteria: Record<string, unknown> }

const COPY: Record<Kind, { title: string; description: string; nameLabel: string; icon: React.ReactNode }> = {
  competitors: { title: "Competitor Analysis", description: "See which suppliers and brands are active for a product category and location, and how their content performs. Observed data is shown separately from AI interpretation.", nameLabel: "Analysis", icon: <Building2 className="h-5 w-5" /> },
  trends: { title: "Trend Analysis", description: "Collect public posts for hashtags and keywords to spot emerging styles, colors and product themes. AI interpretation is clearly labelled.", nameLabel: "Trend report", icon: <TrendingUp className="h-5 w-5" /> },
};

export function AnalysisList({ kind }: { kind: Kind }) {
  const router = useRouter();
  const toast = useToast();
  const list = useQuery<{ items: Row[] }>(`/api/analysis/${kind}?pageSize=50`, { refreshInterval: 8000 });
  const [form, setForm] = useState({ keywords: "", hashtags: "", country: "", city: "", category: "", platform: "INSTAGRAM", limit: 50 });
  const [loading, setLoading] = useState(false);
  const copy = COPY[kind];
  async function submit() {
    setLoading(true);
    try {
      const keywords = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
      const body = kind === "competitors"
        ? { keywords, country: form.country || null, city: form.city || null, category: form.category || null, platform: form.platform, limit: form.limit }
        : { keywords, hashtags: form.hashtags.split(",").map((h) => h.trim()).filter(Boolean), country: form.country || null, city: form.city || null, productCategory: form.category || null, platform: form.platform, limit: form.limit };
      const res = await api<{ search: { id: string } }>(`/api/analysis/${kind}`, { body });
      router.push(`/${kind}/${res.search.id}`);
    } catch (err) {
      toast.error("Could not start analysis", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="animate-in">
      <PageHeader title={copy.title} description={copy.description} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Previous analyses" />
          {list.data?.items.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {list.data.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/${kind}/${r.id}`} className="flex items-center gap-3 py-2.5 hover:underline">
                    <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{r.name ?? r.id}</span><span className="block text-xs text-faint">{formatDateTime(r.createdAt)} · {r.itemCount} posts{r.error ? ` · ${r.error}` : ""}</span></span>
                    <StatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={copy.icon} title={`No ${copy.nameLabel.toLowerCase()} yet`} description="Fill in the form to collect public content and generate a report." />
          )}
        </Card>
        <Card>
          <CardHeader title={`New ${copy.nameLabel.toLowerCase()}`} />
          <div className="space-y-3">
            <Field label="Keywords" description="comma separated"><Input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder={kind === "competitors" ? "hoodies supplier, sportswear manufacturer" : "hoodie, jersey, fitness top"} /></Field>
            {kind === "trends" && <Field label="Hashtags" description="comma separated, without #"><Input value={form.hashtags} onChange={(e) => setForm({ ...form, hashtags: e.target.value })} placeholder="streetwear, gymwear" /></Field>}
            <Field label={kind === "competitors" ? "Business category" : "Product category"}><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country"><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
              <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Platform"><Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option><option value="BOTH">Both</option></Select></Field>
              <Field label="Posts to collect"><Input type="number" min={10} max={500} value={form.limit} onChange={(e) => setForm({ ...form, limit: Number(e.target.value) })} /></Field>
            </div>
            <Button className="w-full" loading={loading} disabled={!form.keywords.trim() && !form.hashtags.trim()} onClick={() => void submit()} icon={<Sparkles className="h-4 w-4" />}>Run analysis</Button>
            <p className="text-xs text-faint">Uses the configured Apify content Actor (Settings → Providers) and your AI provider for the report.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface Detail { search: Row & { aiReport: string | null; resultSummary: { posts: number; accounts: number; avgLikes: number; avgComments: number; topHashtags: Array<{ value: string; count: number }>; topKeywords: Array<{ value: string; count: number }>; colorMentions: Array<{ value: string; count: number }>; topAccounts: Array<{ username: string; name: string | null; posts: number; likes: number; comments: number; url: string | null }>; warnings?: string[] } | null; items: Array<{ id: string; platform: string; accountUsername: string | null; accountUrl: string | null; postUrl: string | null; postedAt: string | null; caption: string | null; likes: number | null; comments: number | null; location: string | null; hashtags: string[] | null }> } }

export function AnalysisDetail({ kind, id }: { kind: Kind; id: string }) {
  const [active, setActive] = useState(true);
  const { data, loading } = useQuery<Detail>(`/api/analysis/${kind}/${id}`, { refreshInterval: active ? 5000 : 0, onData: (d) => setActive(["QUEUED", "RUNNING"].includes((d as Detail).search.status)) });
  const s = data?.search;
  if (loading && !s) return <Skeleton className="h-64" />;
  if (!s) return <p className="text-muted">Not found.</p>;
  const sum = s.resultSummary;
  return (
    <div className="animate-in">
      <PageHeader breadcrumb={<Link href={`/${kind}`} className="hover:underline">{COPY[kind].title}</Link>} title={<span className="flex items-center gap-2">{s.name ?? "Analysis"} <StatusBadge status={s.status} /></span>} description={`${formatDateTime(s.createdAt)} · ${s.itemCount} posts collected`} />
      {s.error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{s.error}</p>}
      {sum?.warnings?.length ? <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{sum.warnings.join(" · ")}</p> : null}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Observed data" description="Computed directly from the collected posts." />
            {sum ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid grid-cols-2 gap-2 text-[13px] sm:col-span-2">
                  {[["Posts", sum.posts], ["Accounts", sum.accounts], ["Avg likes", sum.avgLikes], ["Avg comments", sum.avgComments]].map(([l, v]) => <div key={String(l)} className="rounded-lg bg-surface-2 p-3"><p className="text-[11px] uppercase tracking-wide text-faint">{l}</p><p className="text-lg font-semibold tabular">{formatCompact(Number(v))}</p></div>)}
                </div>
                <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Top hashtags</p><div className="flex flex-wrap gap-1">{sum.topHashtags.slice(0, 20).map((h) => <Badge key={h.value}>#{h.value} · {h.count}</Badge>)}</div></div>
                <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Frequent keywords</p><div className="flex flex-wrap gap-1">{sum.topKeywords.slice(0, 20).map((h) => <Badge key={h.value} tone="brand">{h.value} · {h.count}</Badge>)}</div></div>
                {sum.colorMentions.length > 0 && <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Color mentions</p><div className="flex flex-wrap gap-1">{sum.colorMentions.map((h) => <Badge key={h.value}>{h.value} · {h.count}</Badge>)}</div></div>}
                <div className="sm:col-span-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Most engaged accounts</p><ul className="divide-y divide-[var(--border)] text-[13px]">{sum.topAccounts.slice(0, 10).map((a) => <li key={a.username} className="flex items-center gap-2 py-1.5"><a href={a.url ?? "#"} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">@{a.username}</a><span className="text-muted">{a.name}</span><span className="ml-auto tabular text-muted">{a.posts} posts · {formatCompact(a.likes)} likes</span></li>)}</ul></div>
              </div>
            ) : <p className="text-[13px] text-muted">Waiting for content…</p>}
          </Card>
          <Card>
            <CardHeader title="Collected posts" />
            <ul className="divide-y divide-[var(--border)]">
              {s.items.slice(0, 60).map((p) => (
                <li key={p.id} className="py-2 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    {p.accountUrl ? <a href={p.accountUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">@{p.accountUsername}</a> : <span>@{p.accountUsername ?? "?"}</span>}
                    <span>{p.postedAt ? formatDateTime(p.postedAt) : ""}</span>
                    <span className="tabular">{formatCompact(p.likes)} likes · {formatCompact(p.comments)} comments</span>
                    {p.location && <span>· {p.location}</span>}
                    {p.postUrl && <a href={p.postUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 hover:underline">post <ExternalLink className="h-3 w-3" /></a>}
                  </div>
                  <p className="mt-1 line-clamp-3 text-muted">{p.caption}</p>
                </li>
              ))}
              {!s.items.length && <li className="py-6 text-center text-muted">No posts yet.</li>}
            </ul>
          </Card>
        </div>
        <Card className="border-brand-100 dark:border-brand-800">
          <CardHeader title="AI report" description="Generated interpretation — verify before acting." />
          {s.aiReport ? <div className="prose-sm whitespace-pre-wrap text-[13px]">{s.aiReport}</div> : <p className="text-[13px] text-muted">{s.status === "COMPLETED" ? "No AI report (AI provider not configured or no content)." : "The report is written after content collection finishes."}</p>}
        </Card>
      </div>
    </div>
  );
}
