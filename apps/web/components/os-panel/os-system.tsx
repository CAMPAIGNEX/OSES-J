"use client";

import Link from "next/link";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, timeAgo } from "@/lib/format";
import { OsBadge, OsPageHeader, OsPanel, OsStat } from "./os-shell";

interface SystemInfo {
  config: { ok: boolean; missing: string[]; invalid: string[]; nodeEnv: string };
  runtime: { node: string; platform: string; uptimeSec: number; memoryMb: number; nodeEnv: string; appUrl: string; jobRunnerMode: string; queueDriver: string; logLevel: string };
  database: { ok: boolean; latencyMs: number | null; error: string | null };
  queue: { queued: number; running: number; failed24h: number; oldestQueuedAt: string | null; lastJob: { completedAt: string | null; type: string; status: string } | null };
  providers: { aiDefault: string | null; apifyDefault: boolean; apifyOrigin: string | null; meta: boolean; metaOrigin: string | null; metaWebhookVerify: boolean; superAdminBootstrap: boolean; storageDir: string };
  devices: Array<{ status: string; count: number }>;
  connections: Array<{ status: string; count: number }>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-[#1f2937] py-2 first:border-t-0 first:pt-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">{label}</span>
      <span className="text-right font-mono text-[12px]">{value}</span>
    </div>
  );
}

export function OsSystem() {
  const { data, loading } = useQuery<SystemInfo>("/api/os-panel/system", { refreshInterval: 30_000 });
  if (loading || !data) return <p className="font-mono text-[12px] text-[#6b7280]">Loading…</p>;
  const uptime = data.runtime.uptimeSec > 3600 ? `${Math.floor(data.runtime.uptimeSec / 3600)}h ${Math.floor((data.runtime.uptimeSec % 3600) / 60)}m` : `${Math.floor(data.runtime.uptimeSec / 60)}m`;
  return (
    <>
      <OsPageHeader title="System" description="Runtime, configuration (names only, never values), database, queue and platform provider defaults." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OsStat label="Configuration" value={data.config.ok ? "OK" : "Problem"} tone={data.config.ok ? "green" : "red"} hint={data.config.ok ? `NODE_ENV=${data.config.nodeEnv}` : `missing: ${data.config.missing.join(", ") || "-"} · invalid: ${data.config.invalid.join(", ") || "-"}`} />
        <OsStat label="Database" value={data.database.ok ? `${data.database.latencyMs} ms` : "DOWN"} tone={data.database.ok ? "green" : "red"} hint={data.database.error ?? "SELECT 1 round-trip"} />
        <OsStat label="Queue" value={`${data.queue.queued} queued`} hint={`${data.queue.running} running · ${data.queue.failed24h} failed in 24h`} tone={data.queue.failed24h ? "yellow" : undefined} />
        <OsStat label="Uptime" value={uptime} hint={`${data.runtime.memoryMb} MB RSS · node ${data.runtime.node}`} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <OsPanel title="Runtime">
          <Row label="App URL" value={data.runtime.appUrl} />
          <Row label="Environment" value={data.runtime.nodeEnv} />
          <Row label="Platform" value={data.runtime.platform} />
          <Row label="Job runner" value={<OsBadge tone="blue">{data.runtime.jobRunnerMode}</OsBadge>} />
          <Row label="Queue driver" value={data.runtime.queueDriver} />
          <Row label="Log level" value={data.runtime.logLevel} />
          <Row label="Storage dir" value={data.providers.storageDir} />
        </OsPanel>
        <OsPanel title="Platform defaults" actions={<Link href="/os-panel/platform" className="font-mono text-[11px] uppercase tracking-wider text-bauhaus-yellow hover:underline">Providers &amp; keys →</Link>}>
          <Row label="AI default" value={data.providers.aiDefault ? <OsBadge tone="green">{data.providers.aiDefault}</OsBadge> : <OsBadge tone="red">none · set it in Providers &amp; keys</OsBadge>} />
          <Row label="Apify token" value={data.providers.apifyDefault ? <OsBadge tone="green">set · {data.providers.apifyOrigin}</OsBadge> : <OsBadge tone="red">none · set it in Providers &amp; keys</OsBadge>} />
          <Row label="Meta app" value={data.providers.meta ? <OsBadge tone="green">configured · {data.providers.metaOrigin}</OsBadge> : <OsBadge>not configured</OsBadge>} />
          <Row label="Meta webhook verify token" value={data.providers.metaWebhookVerify ? <OsBadge tone="green">set</OsBadge> : <OsBadge>none</OsBadge>} />
          <Row label="Operator bootstrap" value={data.providers.superAdminBootstrap ? <OsBadge tone="green">SUPER_ADMIN_EMAILS set</OsBadge> : <OsBadge tone="yellow">SUPER_ADMIN_EMAILS not set</OsBadge>} />
        </OsPanel>
        <OsPanel title="Queue">
          <Row label="Queued" value={data.queue.queued} />
          <Row label="Running" value={data.queue.running} />
          <Row label="Failed (24h)" value={data.queue.failed24h} />
          <Row label="Oldest queued" value={data.queue.oldestQueuedAt ? `${timeAgo(data.queue.oldestQueuedAt)} (${formatDateTime(data.queue.oldestQueuedAt)})` : "—"} />
          <Row label="Last finished job" value={data.queue.lastJob ? `${data.queue.lastJob.type} · ${data.queue.lastJob.status} · ${data.queue.lastJob.completedAt ? timeAgo(data.queue.lastJob.completedAt) : ""}` : "—"} />
        </OsPanel>
        <OsPanel title="Devices & connections">
          {data.devices.map((d) => (
            <Row key={d.status} label={`Extension ${d.status.toLowerCase()}`} value={d.count} />
          ))}
          {!data.devices.length && <Row label="Extensions" value="none paired" />}
          {data.connections.map((c) => (
            <Row key={c.status} label={`Meta ${c.status.toLowerCase()}`} value={c.count} />
          ))}
          {!data.connections.length && <Row label="Meta connections" value="none" />}
        </OsPanel>
      </div>
    </>
  );
}
