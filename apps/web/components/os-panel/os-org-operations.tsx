"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { useToast } from "@/components/ui/overlay";
import { ProvidersSettings } from "@/components/settings/settings-pages";
import { AiProviderFields } from "./ai-provider-fields";
import { OsBadge, OsButton, OsInput, OsPanel, OsSelect } from "./os-shell";

interface Status {
  mode: string;
  queueDriver: string;
  jobs: Record<string, number>;
  extension: { enabled: boolean; online: boolean; devices: Array<{ id: string; name: string; status: string }> };
  apify: { configured: boolean; enabled: boolean; origin: string | null; tokenPreview: string | null; providerConfigs: number };
  ai: { provider: string | null; model: string | null; configured: boolean };
  limits: { maxConcurrentJobs: number; maxRetries: number; jobTimeoutSec: number; preferredProvider: string };
}

interface AISettings {
  ready: boolean;
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  platformDefault: { provider: string; model: string | null; origin: "platform" | "environment" | null } | null;
  temperature: number;
}

/**
 * Operator-only operations for one workspace: provider keys, AI provider, delivery/job limits and
 * discovery Actors. Members never see these; they only see readiness in Settings > Automation.
 */
export function OsOrgOperations({ organizationId }: { organizationId: string }) {
  const toast = useToast();
  const scope = `?organizationId=${encodeURIComponent(organizationId)}`;
  const status = useQuery<Status>(`/api/automation/status${scope}`);
  const aiQuery = useQuery<{ settings: AISettings }>(`/api/ai/settings${scope}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [apifyToken, setApifyToken] = useState("");
  const [apifyTest, setApifyTest] = useState<{ ok: boolean; account?: string; error?: string } | null>(null);
  const [limits, setLimits] = useState<Status["limits"] | null>(null);
  const [ai, setAi] = useState({ provider: "platform_default", model: "", baseUrl: "", apiKey: "", temperature: 0.4 });

  useEffect(() => {
    if (status.data && !limits) setLimits(status.data.limits);
  }, [status.data, limits]);
  useEffect(() => {
    const s = aiQuery.data?.settings;
    if (s) setAi({ provider: s.provider ?? "platform_default", model: s.model ?? "", baseUrl: s.baseUrl ?? "", apiKey: "", temperature: s.temperature ?? 0.4 });
  }, [aiQuery.data]);

  async function run(label: string, fn: () => Promise<unknown>, after?: () => void) {
    setBusy(label);
    try {
      await fn();
      toast.success(label);
      after?.();
      await Promise.all([status.refetch(), aiQuery.refetch()]);
    } catch (err) {
      toast.error("Failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const s = status.data;
  const a = aiQuery.data?.settings;
  return (
    <div className="space-y-4">
      <OsPanel title="Discovery provider (Apify)" actions={s ? <OsBadge tone={s.apify.configured ? "green" : "yellow"}>{s.apify.configured ? "ready" : "not ready"}</OsBadge> : undefined}>
        <p className="mb-3 text-[12px] text-[#9ca3af]">
          Token: {s?.apify.tokenPreview ? <span className="font-mono text-white">{s.apify.tokenPreview}</span> : <span className="text-bauhaus-yellow">none</span>}
          {s?.apify.origin ? ` (${s.apify.origin === "organization" ? "workspace override" : `platform default · ${s.apify.origin}`})` : ""} · {s?.apify.providerConfigs ?? 0} discovery Actors · discovery {s?.apify.enabled ? "enabled" : "disabled"} for this workspace · platform token in <Link href="/os-panel/platform" className="underline">Providers &amp; keys</Link>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <OsInput type="password" value={apifyToken} onChange={(e) => setApifyToken(e.target.value)} placeholder="apify_api_…" className="w-80" autoComplete="off" />
          <OsButton tone="primary" disabled={busy !== null || !apifyToken} onClick={() => void run("Apify token saved", () => api(`/api/settings/automation${scope}`, { method: "PUT", body: { apifyToken } }), () => setApifyToken(""))}>
            Save token
          </OsButton>
          <OsButton disabled={busy !== null || !s?.apify.tokenPreview} onClick={() => void run("Apify token removed", () => api(`/api/settings/automation${scope}`, { method: "PUT", body: { apifyToken: "" } }))}>
            Remove workspace token
          </OsButton>
          <OsButton disabled={busy !== null} onClick={() => void api<typeof apifyTest>(`/api/settings/providers/test${scope}`, { body: {} }).then(setApifyTest)}>
            Test connection
          </OsButton>
          <OsButton disabled={busy !== null} onClick={() => void run(s?.apify.enabled ? "Discovery disabled" : "Discovery enabled", () => api(`/api/settings/automation${scope}`, { method: "PUT", body: { apifyEnabled: !s?.apify.enabled } }))}>
            {s?.apify.enabled ? "Disable discovery" : "Enable discovery"}
          </OsButton>
        </div>
        {apifyTest && <p className={`mt-2 font-mono text-[12px] ${apifyTest.ok ? "text-pop-green" : "text-bauhaus-red"}`}>{apifyTest.ok ? `Connected as ${apifyTest.account}` : apifyTest.error}</p>}
      </OsPanel>

      <OsPanel title="AI provider" actions={a ? <OsBadge tone={a.ready ? "green" : "yellow"}>{a.ready ? "ready" : "not ready"}</OsBadge> : undefined}>
        <p className="mb-3 text-[12px] text-[#9ca3af]">
          Platform default: {a?.platformDefault ? <span className="text-white">{a.platformDefault.provider} ({a.platformDefault.model ?? "default model"}){a.platformDefault.origin === "environment" ? " · from server env" : ""}</span> : <span className="text-bauhaus-yellow">none</span>} (<Link href="/os-panel/platform" className="underline">Providers &amp; keys</Link>) · workspace override key: {a?.hasApiKey ? <span className="font-mono text-white">{a.apiKeyPreview}</span> : "none"}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AiProviderFields
            value={ai}
            onChange={(next) => setAi((f) => ({ ...f, ...next }))}
            hasSavedKey={Boolean(a?.hasApiKey)}
            extraOptions={
              <>
                <option value="platform_default">Platform default</option>
                <option value="none">Disabled for this workspace</option>
              </>
            }
          />
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Temperature {ai.temperature.toFixed(2)}</span>
            <input type="range" min={0} max={1} step={0.05} value={ai.temperature} onChange={(e) => setAi((f) => ({ ...f, temperature: Number(e.target.value) }))} className="mt-2 w-full accent-[#f7c948]" />
          </label>
        </div>
        <div className="mt-3 flex gap-2">
          <OsButton tone="primary" disabled={busy !== null} onClick={() => void run("AI provider saved", () => api(`/api/ai/settings${scope}`, { method: "PUT", body: { provider: ai.provider, model: ai.model || null, baseUrl: ai.baseUrl || null, ...(ai.apiKey ? { apiKey: ai.apiKey } : {}), temperature: ai.temperature } }), () => setAi((f) => ({ ...f, apiKey: "" })))}>
            Save AI provider
          </OsButton>
          {a?.hasApiKey && (
            <OsButton disabled={busy !== null} onClick={() => void run("Workspace AI key removed", () => api(`/api/ai/settings${scope}`, { method: "PUT", body: { apiKey: "" } }))}>
              Remove workspace key
            </OsButton>
          )}
        </div>
      </OsPanel>

      <OsPanel title="Delivery & job limits" actions={s ? <OsBadge tone="blue">{`${s.mode} · ${s.queueDriver}`}</OsBadge> : undefined}>
        {limits && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block lg:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Preferred delivery provider</span>
              <OsSelect value={limits.preferredProvider} onChange={(e) => setLimits({ ...limits, preferredProvider: e.target.value })} className="mt-1 w-full">
                <option value="auto">Auto (official → extension → Apify)</option>
                <option value="meta">Official Meta API first</option>
                <option value="extension">Browser extension first</option>
                <option value="apify">Apify first</option>
                <option value="manual">Manual only</option>
              </OsSelect>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Concurrent jobs</span>
              <OsInput type="number" min={1} value={limits.maxConcurrentJobs} onChange={(e) => setLimits({ ...limits, maxConcurrentJobs: Number(e.target.value) })} className="mt-1 w-full" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Retries</span>
              <OsInput type="number" min={0} value={limits.maxRetries} onChange={(e) => setLimits({ ...limits, maxRetries: Number(e.target.value) })} className="mt-1 w-full" />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">Job timeout (s)</span>
              <OsInput type="number" min={30} value={limits.jobTimeoutSec} onChange={(e) => setLimits({ ...limits, jobTimeoutSec: Number(e.target.value) })} className="mt-1 w-full" />
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <OsButton tone="primary" disabled={busy !== null || !limits} onClick={() => limits && void run("Job limits saved", () => api(`/api/settings/automation${scope}`, { method: "PUT", body: limits }))}>
            Save limits
          </OsButton>
          <OsButton disabled={busy !== null} onClick={() => void run(s?.extension.enabled ? "Extension disabled for workspace" : "Extension enabled for workspace", () => api(`/api/settings/automation${scope}`, { method: "PUT", body: { extensionEnabled: !s?.extension.enabled } }))}>
            {s?.extension.enabled ? "Disable browser extension" : "Enable browser extension"}
          </OsButton>
          <span className="font-mono text-[11px] text-[#6b7280]">
            jobs: {s ? Object.entries(s.jobs).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ") : "…"} · devices online: {s?.extension.devices.filter((d) => d.status === "ONLINE").length ?? 0}
          </span>
        </div>
      </OsPanel>

      <OsPanel title="Discovery Actors · workspace overrides (platform defaults in Providers & keys)">
        <div data-template="classic" className="dark">
          <ProvidersSettings organizationId={organizationId} />
        </div>
      </OsPanel>
    </div>
  );
}
