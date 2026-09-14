"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, timeAgo } from "@/lib/format";
import { useToast } from "@/components/ui/overlay";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect, OsTable } from "./os-shell";

interface Detail {
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string | null;
    isActive: boolean;
    isSuperAdmin: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    memberships: Array<{ id: string; role: string; createdAt: string; organization: { id: string; name: string; slug: string; status: string; plan: string } }>;
    sessions: Array<{ id: string; ip: string | null; userAgent: string | null; lastSeenAt: string; expiresAt: string; createdAt: string }>;
    devices: Array<{ id: string; name: string; status: string; lastSeenAt: string | null; organizationId: string }>;
  };
  recentAudit: Array<{ id: string; action: string; organizationId: string | null; createdAt: string; ip: string | null; meta: unknown }>;
}

export function OsUserDetail({ id }: { id: string }) {
  const toast = useToast();
  const { data, loading, refetch } = useQuery<Detail>(`/api/os-panel/users/${id}`);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [role, setRole] = useState("MEMBER");
  const user = data?.user;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
      await refetch();
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) return <p className="font-mono text-[12px] text-[#6b7280]">Loading…</p>;
  return (
    <>
      <OsPageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <Link href="/os-panel/users" className="text-[#6b7280] hover:text-white">
              Users /
            </Link>
            {user.name}
            <OsBadge tone={user.isActive ? "green" : "red"}>{user.isActive ? "active" : "disabled"}</OsBadge>
            {user.isSuperAdmin && <OsBadge tone="yellow">operator</OsBadge>}
          </span>
        }
        description={`${user.email} · created ${formatDateTime(user.createdAt)} · last login ${user.lastLoginAt ? timeAgo(user.lastLoginAt) : "never"} · ${user.timezone ?? "no timezone"}`}
        actions={
          <>
            {user.isActive ? (
              <OsButton tone="danger" disabled={busy} onClick={() => void run("Account disabled", () => api(`/api/os-panel/users/${id}`, { method: "PATCH", body: { isActive: false } }))}>
                Disable account
              </OsButton>
            ) : (
              <OsButton tone="primary" disabled={busy} onClick={() => void run("Account activated", () => api(`/api/os-panel/users/${id}`, { method: "PATCH", body: { isActive: true } }))}>
                Activate account
              </OsButton>
            )}
            <OsButton disabled={busy} onClick={() => void run("Signed out everywhere", () => api(`/api/os-panel/users/${id}/sessions`, { method: "DELETE" }))}>
              Revoke sessions
            </OsButton>
            {user.isSuperAdmin ? (
              <OsButton disabled={busy} onClick={() => void run("Operator access revoked", () => api(`/api/os-panel/users/${id}`, { method: "PATCH", body: { isSuperAdmin: false } }))}>
                Revoke operator
              </OsButton>
            ) : (
              <OsButton disabled={busy} onClick={() => window.confirm(`Grant ${user.email} full OS-Panel access?`) && void run("Operator access granted", () => api(`/api/os-panel/users/${id}`, { method: "PATCH", body: { isSuperAdmin: true } }))}>
                Grant operator
              </OsButton>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <OsPanel title="Workspaces">
            <OsTable>
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {user.memberships.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/os-panel/organizations/${m.organization.id}`} className="font-semibold hover:underline">
                        {m.organization.name}
                      </Link>
                      <span className="block font-mono text-[11px] text-[#6b7280]">{m.organization.plan}</span>
                    </td>
                    <td className="font-mono text-[12px]">{m.role}</td>
                    <td>
                      <OsBadge tone={m.organization.status === "ACTIVE" ? "green" : "red"}>{m.organization.status}</OsBadge>
                    </td>
                    <td className="text-[#9ca3af]">{timeAgo(m.createdAt)}</td>
                    <td className="text-right">
                      <OsButton tone="danger" disabled={busy} onClick={() => window.confirm(`Remove ${user.email} from ${m.organization.name}?`) && void run("Removed from workspace", () => api(`/api/os-panel/users/${id}/memberships?organizationId=${m.organization.id}`, { method: "DELETE" }))}>
                        Remove
                      </OsButton>
                    </td>
                  </tr>
                ))}
                {!user.memberships.length && (
                  <tr>
                    <td colSpan={5} className="text-[#6b7280]">
                      Not a member of any workspace.
                    </td>
                  </tr>
                )}
              </tbody>
            </OsTable>
            <form
              className="mt-4 flex flex-wrap items-end gap-2 border-t border-[#1f2937] pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!orgId) return;
                void run("Membership saved", () => api(`/api/os-panel/users/${id}/memberships`, { method: "POST", body: { organizationId: orgId, role } })).then(() => setOrgId(""));
              }}
            >
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Add to workspace (organization id)</span>
                <OsInput value={orgId} onChange={(e) => setOrgId(e.target.value)} placeholder="paste organization id" className="mt-1 w-80" />
              </label>
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Role</span>
                <OsSelect value={role} onChange={(e) => setRole(e.target.value)} className="mt-1">
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OWNER">Owner</option>
                </OsSelect>
              </label>
              <OsButton type="submit" disabled={busy || !orgId}>
                Add / change role
              </OsButton>
            </form>
          </OsPanel>
          <OsPanel title="Recent activity">
            <OsTable>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>IP</th>
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
                    <td className="font-mono text-[11px] text-[#6b7280]">{a.ip ?? ""}</td>
                    <td className="max-w-[360px] truncate font-mono text-[11px] text-[#6b7280]">{a.meta ? JSON.stringify(a.meta) : ""}</td>
                  </tr>
                ))}
              </tbody>
            </OsTable>
          </OsPanel>
        </div>
        <div className="space-y-4">
          <OsPanel title="Reset password">
            <p className="mb-2 text-[12px] text-[#9ca3af]">Sets a temporary password and signs the user out everywhere. Share it through a secure channel and ask them to change it in Settings → Account.</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (password.length < 10) return;
                void run("Password reset", () => api(`/api/os-panel/users/${id}`, { method: "PATCH", body: { newPassword: password } })).then(() => setPassword(""));
              }}
            >
              <OsInput value={password} onChange={(e) => setPassword(e.target.value)} placeholder="temporary password (10+ chars)" className="flex-1" type="text" autoComplete="off" />
              <OsButton type="submit" tone="danger" disabled={busy || password.length < 10}>
                Reset
              </OsButton>
            </form>
          </OsPanel>
          <OsPanel title="Sessions">
            {user.sessions.length ? (
              <ul className="space-y-2 text-[12px]">
                {user.sessions.map((s) => (
                  <li key={s.id} className="border border-[#1f2937] p-2">
                    <span className="font-mono text-[11px] text-[#9ca3af]">{s.ip ?? "unknown ip"}</span>
                    <span className="block truncate text-[11px] text-[#6b7280]" title={s.userAgent ?? undefined}>
                      {s.userAgent ?? "unknown agent"}
                    </span>
                    <span className="block text-[11px] text-[#9ca3af]">
                      seen {timeAgo(s.lastSeenAt)} · expires {formatDateTime(s.expiresAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#6b7280]">No active sessions.</p>
            )}
          </OsPanel>
          <OsPanel title="Extension devices">
            {user.devices.length ? (
              <ul className="space-y-1 text-[12px]">
                {user.devices.map((d) => (
                  <li key={d.id} className="flex items-center justify-between">
                    <span>{d.name}</span>
                    <span className="flex items-center gap-2 text-[#9ca3af]">
                      <OsBadge tone={d.status === "ONLINE" ? "green" : "neutral"}>{d.status}</OsBadge>
                      {d.lastSeenAt ? timeAgo(d.lastSeenAt) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12px] text-[#6b7280]">No paired devices.</p>
            )}
          </OsPanel>
        </div>
      </div>
    </>
  );
}
