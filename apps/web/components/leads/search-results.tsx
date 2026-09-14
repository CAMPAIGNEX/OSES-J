"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, EmptyState, StatusBadge, cn } from "@/components/ui/primitives";
import { LeadsTable, type LeadPage } from "./leads-table";

interface RunDetail {
  run: {
    id: string;
    query: string;
    status: string;
    stage: string | null;
    criteria: { platforms: string[]; limit: number; location: { city: string | null; region: string | null; country: string | null }; minFollowers: number | null; maxFollowers: number | null; enrich: boolean };
    totalRaw: number;
    totalNormalized: number;
    totalDeduped: number;
    totalNew: number;
    totalEnriched: number;
    error: string | null;
    providerSummary: { warnings?: string[]; runs?: Array<{ actorId: string; adapter: string; status: string; items: number; costUsd: number | null; error: string | null }> } | null;
    providerRuns: Array<{ id: string; actorId: string; adapter: string; purpose: string; status: string; itemCount: number | null; costUsd: string | null; error: string | null; externalRunId: string | null }>;
    job: { status: string; error: string | null; attempts: number; scheduledAt: string } | null;
    leadCount: number;
    createdAt: string;
    completedAt: string | null;
  };
}

const ACTIVE = new Set(["QUEUED", "RUNNING", "ENRICHING"]);

export function SearchResults({ runId }: { runId: string }) {
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(true);
  const onRunData = useCallback((d: unknown) => setActive(ACTIVE.has((d as RunDetail).run.status)), []);
  const run = useQuery<RunDetail>(`/api/leads/search/${runId}`, { refreshInterval: active ? 4000 : 0, onData: onRunData });
  const leads = useQuery<LeadPage>(`/api/leads?searchRunId=${runId}&page=${page}&pageSize=50&sort=score`, { refreshInterval: active ? 6000 : 0 });
  const r = run.data?.run;
  const loc = r ? [r.criteria.location.city, r.criteria.location.region, r.criteria.location.country].filter(Boolean).join(", ") : "";
  const warnings = r?.providerSummary?.warnings ?? [];

  async function cancel() {
    await api(`/api/leads/search/${runId}`, { method: "DELETE" });
    void run.refetch();
  }

  const statusLine = r
    ? r.status === "QUEUED"
      ? "Waiting for a worker to pick up the search…"
      : r.status === "RUNNING"
        ? `Discovering leads${r.stage?.startsWith("provider") ? ` (${r.stage.replace("provider:", "").replace("apify:", "")})` : ""}…`
        : r.status === "ENRICHING"
          ? `Enriching profiles and websites (${r.totalEnriched} done)…`
          : r.status === "COMPLETED"
            ? `Completed ${r.completedAt ? formatDateTime(r.completedAt) : ""}`
            : r.status === "FAILED"
              ? "Search failed"
              : "Cancelled"
    : "";

  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={<Link href="/leads/search" className="hover:underline">Search Leads</Link>}
        title={r?.query ?? "Search results"}
        description={r ? `${r.criteria.platforms.map((p) => (p === "INSTAGRAM" ? "Instagram" : "Facebook")).join(" + ")} · ${r.criteria.limit} requested${loc ? ` · ${loc}` : ""}${r.criteria.minFollowers || r.criteria.maxFollowers ? ` · ${r.criteria.minFollowers ?? 0}–${r.criteria.maxFollowers ?? "∞"} followers` : ""}` : undefined}
        actions={
          <>
            {r && ACTIVE.has(r.status) && (
              <Button variant="outline" onClick={() => void cancel()}>
                Cancel search
              </Button>
            )}
            <Button variant="outline" onClick={() => { void run.refetch(); void leads.refetch(); }} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
            <Button href="/leads/search">New search</Button>
          </>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex items-center gap-2">
            {r && ACTIVE.has(r.status) ? <Loader2 className="h-4 w-4 animate-spin text-brand-500" /> : r?.status === "COMPLETED" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : r?.status === "FAILED" ? <XCircle className="h-4 w-4 text-red-500" /> : null}
            <span className="text-[13px] font-medium">{statusLine}</span>
            {r && <StatusBadge status={r.status} />}
          </div>
          {r && (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
              <div><dt className="inline text-faint">Raw </dt><dd className="inline tabular font-medium text-body">{r.totalRaw}</dd></div>
              <div><dt className="inline text-faint">After dedupe </dt><dd className="inline tabular font-medium text-body">{r.totalDeduped}</dd></div>
              <div><dt className="inline text-faint">New leads </dt><dd className="inline tabular font-medium text-body">{r.totalNew}</dd></div>
              <div><dt className="inline text-faint">Matched existing </dt><dd className="inline tabular font-medium text-body">{Math.max(0, r.leadCount - r.totalNew)}</dd></div>
              <div><dt className="inline text-faint">Enriched </dt><dd className="inline tabular font-medium text-body">{r.totalEnriched}</dd></div>
            </dl>
          )}
        </div>
        {r?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <pre className="whitespace-pre-wrap font-sans">{r.error}</pre>
          </div>
        )}
        {warnings.length > 0 && !r?.error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <ul className="space-y-0.5">
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {r && r.providerRuns.length > 0 && (
          <details className="mt-3 text-xs text-muted">
            <summary className="cursor-pointer select-none">Provider runs ({r.providerRuns.length})</summary>
            <ul className="mt-2 space-y-1">
              {r.providerRuns.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <Badge tone={p.status === "SUCCEEDED" ? "success" : p.status === "FAILED" ? "danger" : "neutral"}>{p.status.toLowerCase()}</Badge>
                  <span className="font-mono">{p.actorId}</span>
                  <span className="text-faint">· {p.adapter} · {p.purpose.toLowerCase()} · {p.itemCount ?? 0} items{p.costUsd ? ` · $${Number(p.costUsd).toFixed(3)}` : ""}</span>
                  {p.externalRunId && (
                    <a href={`https://console.apify.com/actors/runs/${p.externalRunId}`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      run
                    </a>
                  )}
                  {p.error && <span className={cn("text-red-600")}>{p.error}</span>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <LeadsTable
        data={leads.data}
        loading={leads.loading}
        onChanged={() => void leads.refetch()}
        onPage={setPage}
        searchLocation={loc || null}
        emptyMessage={
          r && ACTIVE.has(r.status) ? (
            <EmptyState icon={<Loader2 className="h-5 w-5 animate-spin" />} title="Searching…" description="Results appear here as soon as the provider returns them. This usually takes 1–3 minutes." />
          ) : (
            <EmptyState title="No leads found" description={r?.status === "FAILED" ? "The search failed. Check the provider configuration and try again." : "Try broader keywords, a different platform or a wider follower range."} action={<Button href="/leads/search" size="sm">New search</Button>} />
          )
        }
      />
    </div>
  );
}
