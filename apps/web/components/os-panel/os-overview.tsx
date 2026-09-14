"use client";

import Link from "next/link";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { OsBadge, OsPageHeader, OsPanel, OsStat, OsTable } from "./os-shell";

interface Overview {
  counters: { organizations: number; suspended: number; users: number; activeUsers: number; signups7d: number; leads: number; clients: number; messages24h: number; messages7d: number; replies7d: number; jobsQueued: number; jobsRunning: number; jobsFailed: number; aiActions24h: number; devicesOnline: number };
  recentOrganizations: Array<{ id: string; name: string; slug: string; status: string; plan: string; createdAt: string; _count: { members: number; clients: number } }>;
  recentFailedJobs: Array<{ id: string; type: string; error: string | null; errorClass: string | null; organizationId: string; updatedAt: string; organization: { name: string } | null }>;
}

export function OsOverview() {
  const { data, loading } = useQuery<Overview>("/api/os-panel/overview", { refreshInterval: 30_000 });
  const c = data?.counters;
  const v = (n: number | undefined) => (loading || n === undefined ? "…" : formatNumber(n));
  return (
    <>
      <OsPageHeader title="Overview" description="Platform-wide numbers. Refreshes every 30 seconds." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OsStat label="Organizations" value={v(c?.organizations)} hint={c ? `${c.suspended} suspended` : undefined} tone={c && c.suspended > 0 ? "yellow" : undefined} />
        <OsStat label="Users" value={v(c?.users)} hint={c ? `${c.activeUsers} active this week · ${c.signups7d} new` : undefined} />
        <OsStat label="Clients / leads" value={c ? `${formatNumber(c.clients)} / ${formatNumber(c.leads)}` : "…"} />
        <OsStat label="Messages 24h" value={v(c?.messages24h)} hint={c ? `${formatNumber(c.messages7d)} sent · ${formatNumber(c.replies7d)} replies this week` : undefined} tone="blue" />
        <OsStat label="Jobs queued" value={v(c?.jobsQueued)} hint={c ? `${c.jobsRunning} running` : undefined} />
        <OsStat label="Jobs failed (7d)" value={v(c?.jobsFailed)} tone={c && c.jobsFailed > 0 ? "red" : "green"} />
        <OsStat label="AI actions 24h" value={v(c?.aiActions24h)} />
        <OsStat label="Extensions online" value={v(c?.devicesOnline)} tone="green" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OsPanel title="Newest organizations" actions={<Link href="/os-panel/organizations" className="font-mono text-[11px] uppercase tracking-wider text-[#9ca3af] hover:text-white">All →</Link>}>
          <OsTable>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Plan</th>
                <th>Members</th>
                <th>Clients</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentOrganizations ?? []).map((o) => (
                <tr key={o.id}>
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
                  <td className="tabular-nums">{o._count.members}</td>
                  <td className="tabular-nums">{o._count.clients}</td>
                  <td className="text-[#9ca3af]">{timeAgo(o.createdAt)}</td>
                </tr>
              ))}
              {!loading && !data?.recentOrganizations.length && (
                <tr>
                  <td colSpan={6} className="text-[#6b7280]">
                    No organizations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </OsTable>
        </OsPanel>
        <OsPanel title="Recent failed jobs" actions={<Link href="/os-panel/jobs?status=FAILED" className="font-mono text-[11px] uppercase tracking-wider text-[#9ca3af] hover:text-white">All →</Link>}>
          <OsTable>
            <thead>
              <tr>
                <th>Type</th>
                <th>Organization</th>
                <th>Error</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {(data?.recentFailedJobs ?? []).map((j) => (
                <tr key={j.id}>
                  <td className="font-mono text-[12px]">{j.type}</td>
                  <td>
                    <Link href={`/os-panel/organizations/${j.organizationId}`} className="hover:underline">
                      {j.organization?.name ?? j.organizationId}
                    </Link>
                  </td>
                  <td className="max-w-[320px] truncate text-bauhaus-red" title={j.error ?? undefined}>
                    {j.errorClass && <OsBadge tone="red">{j.errorClass}</OsBadge>} <span className="text-[12px]">{j.error}</span>
                  </td>
                  <td className="whitespace-nowrap text-[#9ca3af]" title={formatDateTime(j.updatedAt)}>
                    {timeAgo(j.updatedAt)}
                  </td>
                </tr>
              ))}
              {!loading && !data?.recentFailedJobs.length && (
                <tr>
                  <td colSpan={4} className="text-pop-green">
                    No failed jobs. Good.
                  </td>
                </tr>
              )}
            </tbody>
          </OsTable>
        </OsPanel>
      </div>
    </>
  );
}
