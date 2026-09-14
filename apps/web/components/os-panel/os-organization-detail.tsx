"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, formatNumber, timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/overlay";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsStat, OsTable } from "./os-shell";

interface Detail {
  organization: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "SUSPENDED";
    plan: string;
    suspendedAt: string | null;
    suspendedReason: string | null;
    internalNotes: string | null;
    country: string | null;
    city: string | null;
    website: string | null;
    contactEmail: string | null;
    timezone: string;
    createdAt: string;
    members: Array<{ id: string; role: string; createdAt: string; user: { id: string; email: string; name: string; isActive: boolean; isSuperAdmin: boolean; lastLoginAt: string | null } }>;
    _count: { leads: number; clients: number; conversations: number; messages: number; campaigns: number; documents: number; extensionDevices: number; socialConnections: number };
    settings: { messagingMode: string; autopilotEnabled: boolean; uiTemplate: string; extensionEnabled: boolean; messagesPerDay: number; messagesPerHour: number; apifyConfigured: boolean; aiProvider: string | null; aiKeyConfigured: boolean } | null;
  };
  usage: Array<{ metric: string; quantity: number }>;
  stats: { failedJobs: number; aiActions30d: number; searchRuns30d: number };
  recentAudit: Array<{ id: string; action: string; actorType: string; createdAt: string; meta: unknown; user: { email: string } | null }>;
}

export function OsOrganizationDetail({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery<Detail>(`/api/os-panel/organizations/${id}`);
  const org = data?.organization;
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("standard");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setPlan(org.plan);
      setNotes(org.internalNotes ?? "");
      setReason(org.suspendedReason ?? "");
    }
  }, [org]);

  async function patch(body: Record<string, unknown>, label: string) {
    setBusy(label);
    try {
      await api(`/api/os-panel/organizations/${id}`, { method: "PATCH", body });
      toast.success(label);
      await refetch();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!org) return;
    if (!window.confirm(`Delete workspace "${org.name}"? Members lose access immediately. Data is kept for recovery by the platform team.`)) return;
    setBusy("delete");
    try {
      await api(`/api/os-panel/organizations/${id}`, { method: "DELETE" });
      toast.success("Workspace deleted");
      router.push("/os-panel/organizations");
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : undefined);
      setBusy(null);
    }
  }

  if (loading || !org) return <p className="font-mono text-[12px] text-[#6b7280]">Loading…</p>;
  const usage = Object.fromEntries(data!.usage.map((u) => [u.metric, u.quantity]));
  return (
    <>
      <OsPageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Link href="/os-panel/organizations" className="text-[#6b7280] hover:text-white">
              Organizations /
            </Link>
            {org.name}
            <OsBadge tone={org.status === "ACTIVE" ? "green" : "red"}>{org.status}</OsBadge>
          </span>
        }
        description={`${org.slug} · created ${formatDateTime(org.createdAt)} · ${[org.city, org.country].filter(Boolean).join(", ") || "no location"} · ${org.timezone}`}
        actions={
          org.status === "ACTIVE" ? (
            <OsButton tone="danger" disabled={busy !== null} onClick={() => void patch({ status: "SUSPENDED", suspendedReason: reason || "Suspended by platform team" }, "Workspace suspended")}>
              Suspend workspace
            </OsButton>
          ) : (
            <OsButton tone="primary" disabled={busy !== null} onClick={() => void patch({ status: "ACTIVE" }, "Workspace activated")}>
              Activate workspace
            </OsButton>
          )
        }
      />
      {org.status === "SUSPENDED" && (
        <div className="mb-4 border border-bauhaus-red bg-bauhaus-red/10 p-3 font-mono text-[12px] text-bauhaus-red">
          Suspended {org.suspendedAt ? timeAgo(org.suspendedAt) : ""}: {org.suspendedReason ?? "no reason recorded"}. Members see a notice; automation is paused.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OsStat label="Clients / leads" value={`${formatNumber(org._count.clients)} / ${formatNumber(org._count.leads)}`} />
        <OsStat label="Conversations / messages" value={`${formatNumber(org._count.conversations)} / ${formatNumber(org._count.messages)}`} />
        <OsStat label="Searches 30d" value={formatNumber(data!.stats.searchRuns30d)} hint={`${formatNumber(usage.ENRICHMENT_REQUESTS ?? 0)} enrichment requests · ${formatNumber(usage.MESSAGES_SENT ?? 0)} messages sent`} />
        <OsStat label="AI actions 30d" value={formatNumber(data!.stats.aiActions30d)} hint={`${formatNumber(usage.AI_TOKENS_IN ?? 0)} in / ${formatNumber(usage.AI_TOKENS_OUT ?? 0)} out tokens`} />
        <OsStat label="Failed jobs" value={formatNumber(data!.stats.failedJobs)} tone={data!.stats.failedJobs ? "red" : "green"} />
        <OsStat label="Campaigns / documents" value={`${org._count.campaigns} / ${org._count.documents}`} />
        <OsStat label="Extension devices" value={org._count.extensionDevices} />
        <OsStat label="Meta connections" value={org._count.socialConnections} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <OsPanel title="Members">
          <OsTable>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last login</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {org.members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/os-panel/users/${m.user.id}`} className="font-semibold hover:underline">
                      {m.user.name}
                    </Link>
                    <span className="block font-mono text-[11px] text-[#6b7280]">{m.user.email}</span>
                  </td>
                  <td className="font-mono text-[12px]">
                    {m.role}
                    {m.user.isSuperAdmin && <OsBadge tone="yellow">operator</OsBadge>}
                  </td>
                  <td>
                    <OsBadge tone={m.user.isActive ? "green" : "red"}>{m.user.isActive ? "active" : "disabled"}</OsBadge>
                  </td>
                  <td className="text-[#9ca3af]">{m.user.lastLoginAt ? timeAgo(m.user.lastLoginAt) : "never"}</td>
                  <td className="text-[#9ca3af]">{timeAgo(m.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </OsTable>
        </OsPanel>
        <OsPanel title="Management">
          <div className="space-y-3">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Name</span>
              <div className="mt-1 flex gap-2">
                <OsInput value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
                <OsButton disabled={busy !== null || name === org.name} onClick={() => void patch({ name }, "Name updated")}>
                  Save
                </OsButton>
              </div>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Plan</span>
              <div className="mt-1 flex gap-2">
                <OsSelect value={plan} onChange={(e) => setPlan(e.target.value)} className="flex-1">
                  {["trial", "standard", "pro", "enterprise", "internal"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </OsSelect>
                <OsButton disabled={busy !== null || plan === org.plan} onClick={() => void patch({ plan }, "Plan updated")}>
                  Save
                </OsButton>
              </div>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Suspension reason (shown to members)</span>
              <OsInput value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full" placeholder="e.g. Payment overdue" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Internal notes (operators only)</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="mt-1 w-full border border-[#374151] bg-[#0a0d14] p-2 font-mono text-[12px] text-[#e6edf7] focus:border-bauhaus-yellow focus:outline-none" />
              <div className="mt-1 flex justify-end">
                <OsButton disabled={busy !== null || notes === (org.internalNotes ?? "")} onClick={() => void patch({ internalNotes: notes || null }, "Notes saved")}>
                  Save notes
                </OsButton>
              </div>
            </label>
            <div className="border-t border-[#1f2937] pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Configuration snapshot</p>
              <ul className="space-y-1 text-[12px] text-[#9ca3af]">
                <li>Mode: <span className="text-white">{org.settings?.messagingMode ?? "—"}</span> {org.settings?.autopilotEnabled ? <OsBadge tone="yellow">autopilot on</OsBadge> : null}</li>
                <li>Template: <span className="text-white">{org.settings?.uiTemplate ?? "classic"}</span></li>
                <li>Limits: <span className="text-white">{org.settings?.messagesPerHour}/h · {org.settings?.messagesPerDay}/day</span></li>
                <li>Apify token: {org.settings?.apifyConfigured ? <OsBadge tone="green">configured</OsBadge> : <OsBadge>none</OsBadge>}</li>
                <li>AI: {org.settings?.aiKeyConfigured ? <OsBadge tone="green">{org.settings.aiProvider ?? "custom"}</OsBadge> : <OsBadge>platform default</OsBadge>}</li>
                <li>Extension: {org.settings?.extensionEnabled ? <OsBadge tone="green">enabled</OsBadge> : <OsBadge>disabled</OsBadge>}</li>
              </ul>
            </div>
            <div className="border-t border-[#1f2937] pt-3">
              <OsButton tone="danger" disabled={busy !== null} onClick={() => void remove()}>
                Delete workspace
              </OsButton>
            </div>
          </div>
        </OsPanel>
      </div>

      <OsPanel title="Recent audit events" className="mt-4">
        <OsTable>
          <thead>
            <tr>
              <th>When</th>
              <th>Action</th>
              <th>Actor</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {data!.recentAudit.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap text-[#9ca3af]" title={formatDateTime(a.createdAt)}>
                  {timeAgo(a.createdAt)}
                </td>
                <td className="font-mono text-[12px]">{a.action}</td>
                <td className="text-[#9ca3af]">{a.user?.email ?? a.actorType}</td>
                <td className="max-w-[420px] truncate font-mono text-[11px] text-[#6b7280]">{a.meta ? JSON.stringify(a.meta) : ""}</td>
              </tr>
            ))}
          </tbody>
        </OsTable>
      </OsPanel>
    </>
  );
}
