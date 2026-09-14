"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@/lib/hooks/use-query";
import { formatNumber, timeAgo } from "@/lib/format";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsTable } from "./os-shell";

interface UserRow {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  memberships: Array<{ role: string; organization: { id: string; name: string; status: string } }>;
  _count: { sessions: number };
}

export function OsUsers() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: "25" });
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  const { data, loading } = useQuery<{ items: UserRow[]; total: number; totalPages: number }>(`/api/os-panel/users?${params.toString()}`);
  return (
    <>
      <OsPageHeader title="Users" description="Every account on the platform with its workspaces. Open a user to reset a password, disable the account, revoke sessions or grant operator access." />
      <OsPanel>
        <form
          className="mb-4 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
          }}
        >
          <OsInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name, workspace" className="w-72" />
          <OsSelect value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Disabled</option>
            <option value="operators">Operators</option>
          </OsSelect>
          <OsButton type="submit">Search</OsButton>
          <span className="ml-auto font-mono text-[11px] text-[#6b7280]">{data ? `${formatNumber(data.total)} users` : ""}</span>
        </form>
        <OsTable>
          <thead>
            <tr>
              <th>User</th>
              <th>Workspaces</th>
              <th>Status</th>
              <th>Sessions</th>
              <th>Last login</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items ?? []).map((u) => (
              <tr key={u.id} className="hover:bg-[#131826]">
                <td>
                  <Link href={`/os-panel/users/${u.id}`} className="font-semibold hover:underline">
                    {u.name}
                  </Link>
                  <span className="block font-mono text-[11px] text-[#6b7280]">{u.email}</span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {u.memberships.map((m) => (
                      <Link key={m.organization.id} href={`/os-panel/organizations/${m.organization.id}`} className="border border-[#374151] px-1.5 py-0.5 font-mono text-[10px] hover:bg-[#1f2937]">
                        {m.organization.name} · {m.role.toLowerCase()}
                        {m.organization.status === "SUSPENDED" ? " · suspended" : ""}
                      </Link>
                    ))}
                    {!u.memberships.length && <span className="text-[#6b7280]">none</span>}
                  </div>
                </td>
                <td>
                  <div className="flex gap-1">
                    <OsBadge tone={u.isActive ? "green" : "red"}>{u.isActive ? "active" : "disabled"}</OsBadge>
                    {u.isSuperAdmin && <OsBadge tone="yellow">operator</OsBadge>}
                  </div>
                </td>
                <td className="tabular-nums">{u._count.sessions}</td>
                <td className="text-[#9ca3af]">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : "never"}</td>
                <td className="whitespace-nowrap text-[#9ca3af]">{timeAgo(u.createdAt)}</td>
              </tr>
            ))}
            {!loading && !data?.items.length && (
              <tr>
                <td colSpan={6} className="text-[#6b7280]">
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
