"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/lib/hooks/use-query";
import { formatNumber, timeAgo } from "@/lib/format";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsTable } from "./os-shell";

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  country: string | null;
  city: string | null;
  createdAt: string;
  _count: { members: number; clients: number; leads: number; messages: number };
  settings: { messagingMode: string; autopilotEnabled: boolean; uiTemplate: string } | null;
}

export function OsOrganizations() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const { data, loading } = useQuery<{ items: OrgRow[]; total: number; totalPages: number }>(`/api/os-panel/organizations?${params.toString()}`);
  return (
    <>
      <OsPageHeader title="Organizations" description="Every workspace on the platform. Open one to manage members, plan, status and notes." />
      <OsPanel>
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <OsInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, slug, member email" className="w-72" />
          <OsSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </OsSelect>
          <OsButton type="submit">Search</OsButton>
          <span className="ml-auto font-mono text-[11px] text-[#6b7280]">{data ? `${formatNumber(data.total)} organizations` : ""}</span>
        </form>
        <OsTable>
          <thead>
            <tr>
              <th>Organization</th>
              <th>Status</th>
              <th>Plan</th>
              <th>Mode</th>
              <th>Template</th>
              <th>Members</th>
              <th>Clients</th>
              <th>Leads</th>
              <th>Messages</th>
              <th>Location</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((o) => (
              <tr key={o.id} className="hover:bg-[#131826]">
                <td>
                  <Link href={`/os-panel/organizations/${o.id}`} className="font-semibold hover:underline">
                    {o.name}
                  </Link>
                  <span className="block font-mono text-[11px] text-[#6b7280]">{o.slug}</span>
                </td>
                <td>
                  <OsBadge tone={o.status === "ACTIVE" ? "green" : "red"}>{o.status}</OsBadge>
                </td>
                <td className="font-mono text-[12px]">{o.plan}</td>
                <td className="font-mono text-[12px]">
                  {o.settings?.messagingMode ?? "—"}
                  {o.settings?.autopilotEnabled && <OsBadge tone="yellow">auto</OsBadge>}
                </td>
                <td className="font-mono text-[12px]">{o.settings?.uiTemplate ?? "classic"}</td>
                <td className="tabular-nums">{o._count.members}</td>
                <td className="tabular-nums">{formatNumber(o._count.clients)}</td>
                <td className="tabular-nums">{formatNumber(o._count.leads)}</td>
                <td className="tabular-nums">{formatNumber(o._count.messages)}</td>
                <td className="text-[#9ca3af]">{[o.city, o.country].filter(Boolean).join(", ") || "—"}</td>
                <td className="whitespace-nowrap text-[#9ca3af]">{timeAgo(o.createdAt)}</td>
              </tr>
            ))}
            {!loading && !data?.items.length && (
              <tr>
                <td colSpan={11} className="text-[#6b7280]">
                  Nothing matches.
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
