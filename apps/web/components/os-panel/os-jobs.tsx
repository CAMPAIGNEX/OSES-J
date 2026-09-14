"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/overlay";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsTable } from "./os-shell";

interface JobRow {
  id: string;
  type: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  errorClass: string | null;
  lockedBy: string | null;
  entityType: string | null;
  entityId: string | null;
  updatedAt: string;
  organizationId: string;
  organization: { name: string } | null;
}

const TONE: Record<string, "green" | "red" | "yellow" | "blue" | "neutral"> = { COMPLETED: "green", FAILED: "red", RUNNING: "yellow", QUEUED: "blue", CANCELLED: "neutral" };

export function OsJobs() {
  const initial = useSearchParams();
  const toast = useToast();
  const [status, setStatus] = useState(initial.get("status") ?? "");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "40" });
  if (status) params.set("status", status);
  if (type) params.set("type", type);
  if (q) params.set("q", q);
  const { data, loading, refetch } = useQuery<{ items: JobRow[]; total: number; totalPages: number; byStatus: Array<{ status: string; count: number }> }>(`/api/os-panel/jobs?${params.toString()}`, { refreshInterval: 15_000 });
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "retry" | "cancel") {
    setBusy(id);
    try {
      await api(`/api/os-panel/jobs/${id}`, { method: "POST", body: { action } });
      toast.success(action === "retry" ? "Job re-queued" : "Job cancelled");
      await refetch();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <OsPageHeader title="Jobs" description="The automation queue across all workspaces. Retry failed jobs or cancel queued ones. Refreshes every 15 seconds." />
      <div className="mb-4 flex flex-wrap gap-2">
        {(data?.byStatus ?? []).map((s) => (
          <button key={s.status} type="button" onClick={() => setStatus(status === s.status ? "" : s.status)} className={`border px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider ${status === s.status ? "border-bauhaus-yellow bg-bauhaus-yellow text-[#111]" : "border-[#374151] text-[#9ca3af] hover:bg-[#1f2937]"}`}>
            {s.status} <span className="tabular-nums">{formatNumber(s.count)}</span>
          </button>
        ))}
      </div>
      <OsPanel>
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <OsInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search error, id, workspace" className="w-72" />
          <OsSelect value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {["DISCOVERY_JOB", "ENRICHMENT_JOB", "MESSAGE_JOB", "FOLLOWUP_JOB", "AI_REPLY_JOB", "AI_FIRST_MESSAGE_JOB", "EXPORT_JOB", "DOCUMENT_PROCESSING_JOB", "TRASH_CLEANUP_JOB", "CAMPAIGN_STEP_JOB", "SCHEDULED_MESSAGE_JOB", "COMPETITOR_ANALYSIS_JOB", "TREND_ANALYSIS_JOB", "WEBHOOK_EVENT_JOB"].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </OsSelect>
          <OsButton type="submit">Filter</OsButton>
          <span className="ml-auto font-mono text-[11px] text-[#6b7280]">{data ? `${formatNumber(data.total)} jobs` : ""}</span>
        </form>
        <OsTable>
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Workspace</th>
              <th>Attempts</th>
              <th>Scheduled</th>
              <th>Updated</th>
              <th>Error</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((j) => (
              <tr key={j.id} className="hover:bg-[#131826]">
                <td>
                  <span className="font-mono text-[12px]">{j.type}</span>
                  <span className="block font-mono text-[10px] text-[#6b7280]">
                    {j.id.slice(-12)}
                    {j.entityType ? ` · ${j.entityType}` : ""}
                  </span>
                </td>
                <td>
                  <OsBadge tone={TONE[j.status] ?? "neutral"}>{j.status}</OsBadge>
                  {j.lockedBy && <span className="block font-mono text-[10px] text-[#6b7280]">{j.lockedBy}</span>}
                </td>
                <td>
                  <Link href={`/os-panel/organizations/${j.organizationId}`} className="hover:underline">
                    {j.organization?.name ?? j.organizationId}
                  </Link>
                </td>
                <td className="tabular-nums">
                  {j.attempts}/{j.maxAttempts}
                </td>
                <td className="whitespace-nowrap text-[#9ca3af]" title={formatDateTime(j.scheduledAt)}>
                  {timeAgo(j.scheduledAt)}
                </td>
                <td className="whitespace-nowrap text-[#9ca3af]" title={formatDateTime(j.updatedAt)}>
                  {timeAgo(j.updatedAt)}
                </td>
                <td className="max-w-[360px]">
                  {j.errorClass && <OsBadge tone="red">{j.errorClass}</OsBadge>}
                  <span className="block truncate text-[12px] text-bauhaus-red" title={j.error ?? undefined}>
                    {j.error}
                  </span>
                </td>
                <td className="whitespace-nowrap text-right">
                  {(j.status === "FAILED" || j.status === "CANCELLED") && (
                    <OsButton disabled={busy === j.id} onClick={() => void act(j.id, "retry")}>
                      Retry
                    </OsButton>
                  )}
                  {(j.status === "QUEUED" || j.status === "RUNNING") && (
                    <OsButton tone="danger" disabled={busy === j.id} onClick={() => void act(j.id, "cancel")}>
                      Cancel
                    </OsButton>
                  )}
                </td>
              </tr>
            ))}
            {!loading && !data?.items.length && (
              <tr>
                <td colSpan={8} className="text-[#6b7280]">
                  No jobs match.
                </td>
              </tr>
            )}
          </tbody>
        </OsTable>
        {data && data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-end gap-2 font-mono text-[11px] text-[#9ca3af]">
            <OsButton onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Prev
            </OsButton>
            <span>
              {page} / {data.totalPages}
            </span>
            <OsButton onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages}>
              Next
            </OsButton>
          </div>
        )}
      </OsPanel>
    </>
  );
}
