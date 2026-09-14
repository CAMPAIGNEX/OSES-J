"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsTable } from "./os-shell";

interface AuditRow {
  id: string;
  action: string;
  actorType: string;
  entityType: string | null;
  entityId: string | null;
  ip: string | null;
  meta: unknown;
  createdAt: string;
  organizationId: string | null;
  organization: { name: string } | null;
  user: { email: string; name: string } | null;
}

export function OsAudit() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (q) params.set("q", q);
  if (action) params.set("action", action);
  const { data, loading } = useQuery<{ items: AuditRow[]; total: number; totalPages: number }>(`/api/os-panel/audit?${params.toString()}`);
  return (
    <>
      <OsPageHeader title="Audit log" description="Every important action on the platform: logins, settings, sends, deletions, AI decisions and OS-Panel operations (prefixed os.)." />
      <OsPanel>
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <OsInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, email, workspace, entity id" className="w-80" />
          <OsSelect value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            <option value="os.">OS-Panel operations</option>
            <option value="auth.">Authentication</option>
            <option value="settings.">Settings</option>
            <option value="message.">Messages</option>
            <option value="search.">Searches</option>
            <option value="client.">Clients</option>
            <option value="campaign.">Campaigns</option>
            <option value="ai.">AI</option>
          </OsSelect>
          <OsButton type="submit">Filter</OsButton>
          <span className="ml-auto font-mono text-[11px] text-[#6b7280]">{data ? `${formatNumber(data.total)} events` : ""}</span>
        </form>
        <OsTable>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Workspace</th>
              <th>Entity</th>
              <th>IP</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((a) => (
              <tr key={a.id} className="hover:bg-[#131826]">
                <td className="whitespace-nowrap text-[#9ca3af]" title={formatDateTime(a.createdAt)}>
                  {timeAgo(a.createdAt)}
                </td>
                <td className="font-mono text-[12px]">
                  {a.action.startsWith("os.") ? <OsBadge tone="yellow">{a.action}</OsBadge> : a.action}
                </td>
                <td>
                  {a.user ? (
                    <span>
                      {a.user.name}
                      <span className="block font-mono text-[11px] text-[#6b7280]">{a.user.email}</span>
                    </span>
                  ) : (
                    <OsBadge>{a.actorType}</OsBadge>
                  )}
                </td>
                <td>
                  {a.organizationId ? (
                    <Link href={`/os-panel/organizations/${a.organizationId}`} className="hover:underline">
                      {a.organization?.name ?? a.organizationId}
                    </Link>
                  ) : (
                    <span className="text-[#6b7280]">—</span>
                  )}
                </td>
                <td className="font-mono text-[11px] text-[#9ca3af]">{a.entityType ? `${a.entityType} ${a.entityId?.slice(-8) ?? ""}` : ""}</td>
                <td className="font-mono text-[11px] text-[#6b7280]">{a.ip ?? ""}</td>
                <td className="max-w-[360px] truncate font-mono text-[11px] text-[#6b7280]" title={a.meta ? JSON.stringify(a.meta) : undefined}>
                  {a.meta ? JSON.stringify(a.meta) : ""}
                </td>
              </tr>
            ))}
            {!loading && !data?.items.length && (
              <tr>
                <td colSpan={7} className="text-[#6b7280]">
                  No events match.
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
