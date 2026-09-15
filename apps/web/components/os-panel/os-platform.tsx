"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime } from "@/lib/format";
import { useToast } from "@/components/ui/overlay";
import { ProvidersSettings } from "@/components/settings/settings-pages";
import { AiProviderFields } from "./ai-provider-fields";
import { OsBadge, OsButton, OsInput, OsPageHeader, OsPanel, OsSelect } from "./os-shell";

type Origin = "platform" | "environment" | null;

interface PlatformView {
  updatedAt: string | null;
  apify: { enabled: boolean; hasToken: boolean; tokenPreview: string | null; effective: { configured: boolean; origin: Origin; preview: string | null }; environmentFallback: boolean };
  ai: { provider: string; model: string | null; baseUrl: string | null; hasApiKey: boolean; apiKeyPreview: string | null; effective: { provider: string; model: string | null; origin: Origin; configured: boolean }; environmentFallback: string | null };
  embeddings: { provider: string; model: string | null; hasApiKey: boolean; apiKeyPreview: string | null; effective: { provider: string; model: string | null; origin: Origin; configured: boolean }; environmentFallback: boolean };
  google: { cseId: string | null; hasApiKey: boolean; apiKeyPreview: string | null; effective: { configured: boolean; origin: Origin; cseId: string | null }; environmentFallback: boolean };
  meta: { appId: string | null; hasAppSecret: boolean; appSecretPreview: string | null; webhookVerifyToken: string | null; effective: { configured: boolean; origin: Origin; appId: string | null; webhookConfigured: boolean }; environmentFallback: boolean; callbackUrl: string };
}

interface TestResult {
  ok: boolean;
  detail?: string;
  error?: string;
  source?: string;
  durationMs?: number;
}

function OriginBadge({ origin, configured }: { origin: Origin; configured: boolean }) {
  if (!configured) return <OsBadge tone="red">not set</OsBadge>;
  if (origin === "platform") return <OsBadge tone="green">set here</OsBadge>;
  return <OsBadge tone="yellow">from server environment</OsBadge>;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#6b7280]">{children}</span>;
}

function TestLine({ result }: { result: TestResult | null }) {
  if (!result) return null;
  return <p className={`mt-2 font-mono text-[12px] ${result.ok ? "text-pop-green" : "text-bauhaus-red"}`}>{result.ok ? result.detail : result.error}{result.source ? <span className="text-[#6b7280]"> · tested {result.source === "typed" ? "the value typed above" : `the ${result.source} value`}</span> : null}</p>;
}

/**
 * One place for everything that runs behind OSES-J: the Apify token, the AI provider and key, the
 * embedding provider and the Meta app. Every workspace uses these unless an operator set an override on
 * that workspace's page. Environment variables are only the fallback for empty fields.
 */
export function OsPlatform() {
  const toast = useToast();
  const q = useQuery<{ settings: PlatformView }>("/api/os-panel/platform");
  const s = q.data?.settings;
  const [busy, setBusy] = useState<string | null>(null);
  const [apifyToken, setApifyToken] = useState("");
  const [ai, setAi] = useState({ provider: "", model: "", baseUrl: "", apiKey: "" });
  const [emb, setEmb] = useState({ provider: "", model: "", apiKey: "" });
  const [meta, setMeta] = useState({ appId: "", appSecret: "", webhookVerifyToken: "" });
  const [google, setGoogle] = useState({ apiKey: "", cseId: "" });
  const [tests, setTests] = useState<Record<string, TestResult | null>>({});

  useEffect(() => {
    if (!s) return;
    setAi({ provider: s.ai.provider, model: s.ai.model ?? "", baseUrl: s.ai.baseUrl ?? "", apiKey: "" });
    setEmb({ provider: s.embeddings.provider, model: s.embeddings.model ?? "", apiKey: "" });
    setMeta({ appId: s.meta.appId ?? "", appSecret: "", webhookVerifyToken: s.meta.webhookVerifyToken ?? "" });
    setGoogle({ apiKey: "", cseId: s.google.cseId ?? "" });
  }, [s]);

  async function save(label: string, body: Record<string, unknown>, after?: () => void) {
    setBusy(label);
    try {
      await api("/api/os-panel/platform", { method: "PUT", body });
      toast.success(label);
      after?.();
      await q.refetch();
    } catch (err) {
      toast.error("Not saved", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const [actorsVersion, setActorsVersion] = useState(0);
  async function seedActors() {
    setBusy("seed");
    try {
      const r = await api<{ created: number; skipped: number }>("/api/os-panel/platform/actors", { body: {} });
      toast.success(r.created ? `${r.created} default Actor${r.created === 1 ? "" : "s"} added` : "Recommended Actors already present");
      setActorsVersion((v) => v + 1);
      await q.refetch();
    } catch (err) {
      toast.error("Could not add Actors", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  async function test(key: string, body: Record<string, unknown>) {
    setBusy(`test:${key}`);
    setTests((t) => ({ ...t, [key]: null }));
    try {
      const r = await api<TestResult>("/api/os-panel/platform/test", { body });
      setTests((t) => ({ ...t, [key]: r }));
    } catch (err) {
      setTests((t) => ({ ...t, [key]: { ok: false, error: err instanceof Error ? err.message : "Test failed" } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <OsPageHeader
        title="Providers & keys"
        description={
          <>
            The one place for everything that works behind OSES-J. Every workspace uses these by default; a workspace-specific override can be set on its page under <Link href="/os-panel/organizations" className="underline">Organizations</Link> → Operations. Server environment variables are only the fallback for fields left empty here. Members never see any of this.
          </>
        }
        actions={s?.updatedAt ? <span className="font-mono text-[11px] text-[#6b7280]">last change {formatDateTime(s.updatedAt)}</span> : undefined}
      />

      {!s ? (
        <p className="font-mono text-[12px] text-[#6b7280]">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatusCard label="Lead discovery (Apify)" origin={s.apify.effective.origin} configured={s.apify.effective.configured && s.apify.enabled} hint={!s.apify.enabled ? "disabled platform-wide" : s.apify.effective.preview ?? "no token"} />
            <StatusCard label="Google search API" origin={s.google.effective.origin} configured={s.google.effective.configured} hint={s.google.effective.configured ? `engine ${s.google.effective.cseId}` : "search-engine strategy uses Apify"} />
            <StatusCard label="AI provider" origin={s.ai.effective.origin} configured={s.ai.effective.configured} hint={s.ai.effective.configured ? `${s.ai.effective.provider} · ${s.ai.effective.model ?? "default model"}` : "no provider / key"} />
            <StatusCard label="Embeddings" origin={s.embeddings.effective.origin} configured={s.embeddings.effective.configured} hint={s.embeddings.effective.configured ? `${s.embeddings.effective.provider} · ${s.embeddings.effective.model ?? "default model"}` : "keyword search only"} />
            <StatusCard label="Meta app" origin={s.meta.effective.origin} configured={s.meta.effective.configured} hint={s.meta.effective.configured ? `app ${s.meta.effective.appId} · webhook ${s.meta.effective.webhookConfigured ? "ok" : "no verify token"}` : "official Instagram / Facebook API off"} />
          </div>

          <OsPanel title="Lead discovery & enrichment · Apify token" actions={<OriginBadge origin={s.apify.effective.origin} configured={s.apify.effective.configured} />}>
            <p className="mb-3 text-[12px] text-[#9ca3af]">
              Platform token: {s.apify.tokenPreview ? <span className="font-mono text-white">{s.apify.tokenPreview}</span> : <span className="text-bauhaus-yellow">none saved here</span>}
              {!s.apify.hasToken && s.apify.environmentFallback ? " · currently using APIFY_API_TOKEN from the server environment" : ""} · discovery is {s.apify.enabled ? <span className="text-pop-green">enabled</span> : <span className="text-bauhaus-red">disabled for every workspace</span>}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <OsInput type="password" value={apifyToken} onChange={(e) => setApifyToken(e.target.value)} placeholder="apify_api_…" className="w-80 max-w-full" autoComplete="off" />
              <OsButton tone="primary" disabled={busy !== null || !apifyToken} onClick={() => void save("Apify token saved for the platform", { apifyToken }, () => setApifyToken(""))}>
                Save token
              </OsButton>
              <OsButton disabled={busy !== null} onClick={() => void test("apify", { target: "apify", ...(apifyToken ? { apifyToken } : {}) })}>
                {busy === "test:apify" ? "Testing…" : apifyToken ? "Test typed token" : "Test saved token"}
              </OsButton>
              {s.apify.hasToken && (
                <OsButton tone="danger" disabled={busy !== null} onClick={() => void save("Platform Apify token removed", { apifyToken: "" })}>
                  Remove
                </OsButton>
              )}
              <OsButton disabled={busy !== null} onClick={() => void save(s.apify.enabled ? "Discovery disabled platform-wide" : "Discovery enabled platform-wide", { apifyEnabled: !s.apify.enabled })}>
                {s.apify.enabled ? "Disable discovery everywhere" : "Enable discovery"}
              </OsButton>
            </div>
            <TestLine result={tests.apify ?? null} />
          </OsPanel>

          <OsPanel title="Google search API · search-engine strategy without Apify (100 free queries a day)" actions={<OriginBadge origin={s.google.effective.origin} configured={s.google.effective.configured} />}>
            <p className="mb-3 text-[12px] text-[#9ca3af]">
              Official Google Custom Search JSON API: create a Programmable Search Engine that searches the entire web, copy its <span className="font-mono text-white">Search engine ID (cx)</span>, and create an API key in Google Cloud with the Custom Search API enabled. When set, the &ldquo;Search engine&rdquo; strategy runs here for free (100 queries/day, then $5 per 1,000) and the paid Apify search Actor is skipped.
              {s.google.apiKeyPreview ? <> Saved key: <span className="font-mono text-white">{s.google.apiKeyPreview}</span>.</> : null}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>API key {s.google.hasApiKey ? "(blank keeps the saved key)" : ""}</FieldLabel>
                <OsInput type="password" value={google.apiKey} onChange={(e) => setGoogle((f) => ({ ...f, apiKey: e.target.value }))} placeholder={s.google.hasApiKey ? "••••••••" : "AIza…"} className="mt-1 w-full" autoComplete="off" />
              </label>
              <label className="block">
                <FieldLabel>Search engine ID (cx)</FieldLabel>
                <OsInput value={google.cseId} onChange={(e) => setGoogle((f) => ({ ...f, cseId: e.target.value }))} placeholder="a1b2c3d4e5f6g7h8i" className="mt-1 w-full" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <OsButton tone="primary" disabled={busy !== null || (!google.cseId && !s.google.cseId)} onClick={() => void save("Google search API saved", { googleCseId: google.cseId || null, ...(google.apiKey ? { googleApiKey: google.apiKey } : {}) }, () => setGoogle((f) => ({ ...f, apiKey: "" })))}>
                Save Google search
              </OsButton>
              <OsButton disabled={busy !== null || (!google.apiKey && !s.google.effective.configured)} onClick={() => void test("google", { target: "google", ...(google.apiKey || google.cseId ? { google: { ...(google.apiKey ? { apiKey: google.apiKey } : {}), ...(google.cseId ? { cseId: google.cseId } : {}) } } : {}) })}>
                {busy === "test:google" ? "Testing…" : "Test (one free query)"}
              </OsButton>
              {(s.google.hasApiKey || s.google.cseId) && (
                <OsButton tone="danger" disabled={busy !== null} onClick={() => void save("Google search API removed", { googleApiKey: "", googleCseId: "" })}>
                  Remove
                </OsButton>
              )}
            </div>
            <TestLine result={tests.google ?? null} />
          </OsPanel>

          <OsPanel title="AI provider · used by every workspace without its own key" actions={<OriginBadge origin={s.ai.effective.origin} configured={s.ai.effective.configured} />}>
            <p className="mb-3 text-[12px] text-[#9ca3af]">
              Saved here: {s.ai.provider ? <span className="text-white">{s.ai.provider}{s.ai.model ? ` · ${s.ai.model}` : ""}</span> : <span className="text-bauhaus-yellow">nothing</span>} · key {s.ai.apiKeyPreview ? <span className="font-mono text-white">{s.ai.apiKeyPreview}</span> : "none"}
              {s.ai.environmentFallback ? ` · server environment fallback: ${s.ai.environmentFallback}` : " · no environment fallback"}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <AiProviderFields
                value={ai}
                onChange={setAi}
                hasSavedKey={s.ai.hasApiKey}
                extraOptions={
                  <>
                    <option value="">Not set (use server environment)</option>
                    <option value="none">Disabled for the whole platform</option>
                  </>
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <OsButton tone="primary" disabled={busy !== null} onClick={() => void save("Platform AI provider saved", { aiProvider: ai.provider, aiModel: ai.model || null, aiBaseUrl: ai.baseUrl || null, ...(ai.apiKey ? { aiApiKey: ai.apiKey } : {}) }, () => setAi((f) => ({ ...f, apiKey: "" })))}>
                Save AI provider
              </OsButton>
              <OsButton disabled={busy !== null || (!ai.provider && !s.ai.effective.configured) || ai.provider === "none"} onClick={() => void test("ai", { target: "ai", ...(ai.provider && ai.provider !== "none" ? { ai: { provider: ai.provider, model: ai.model || null, baseUrl: ai.baseUrl || null, ...(ai.apiKey ? { apiKey: ai.apiKey } : {}) } } : {}) })}>
                {busy === "test:ai" ? "Testing…" : "Test (sends one tiny request)"}
              </OsButton>
              {s.ai.hasApiKey && (
                <OsButton tone="danger" disabled={busy !== null} onClick={() => void save("Platform AI key removed", { aiApiKey: "" })}>
                  Remove key
                </OsButton>
              )}
            </div>
            <TestLine result={tests.ai ?? null} />
          </OsPanel>

          <OsPanel title="Embeddings · knowledge base search" actions={<OriginBadge origin={s.embeddings.effective.origin} configured={s.embeddings.effective.configured} />}>
            <p className="mb-3 text-[12px] text-[#9ca3af]">Optional. Without embeddings the knowledge base falls back to keyword search. With OpenAI selected and no key here, the OpenAI chat key above is reused.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <FieldLabel>Provider</FieldLabel>
                <OsSelect value={emb.provider} onChange={(e) => setEmb((f) => ({ ...f, provider: e.target.value }))} className="mt-1 w-full">
                  <option value="">Not set (use server environment)</option>
                  <option value="openai">OpenAI embeddings</option>
                  <option value="none">Disabled</option>
                </OsSelect>
              </label>
              <label className="block">
                <FieldLabel>Model</FieldLabel>
                <OsInput value={emb.model} onChange={(e) => setEmb((f) => ({ ...f, model: e.target.value }))} placeholder="text-embedding-3-small" className="mt-1 w-full" />
              </label>
              <label className="block">
                <FieldLabel>API key {s.embeddings.hasApiKey ? "(blank keeps the saved key)" : "(optional)"}</FieldLabel>
                <OsInput type="password" value={emb.apiKey} onChange={(e) => setEmb((f) => ({ ...f, apiKey: e.target.value }))} placeholder={s.embeddings.hasApiKey ? "••••••••" : "sk-…"} className="mt-1 w-full" autoComplete="off" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <OsButton tone="primary" disabled={busy !== null} onClick={() => void save("Embedding provider saved", { embeddingProvider: emb.provider, embeddingModel: emb.model || null, ...(emb.apiKey ? { embeddingApiKey: emb.apiKey } : {}) }, () => setEmb((f) => ({ ...f, apiKey: "" })))}>
                Save embeddings
              </OsButton>
              {s.embeddings.hasApiKey && (
                <OsButton tone="danger" disabled={busy !== null} onClick={() => void save("Embedding key removed", { embeddingApiKey: "" })}>
                  Remove key
                </OsButton>
              )}
            </div>
          </OsPanel>

          <OsPanel title="Meta app · official Instagram / Facebook messaging" actions={<OriginBadge origin={s.meta.effective.origin} configured={s.meta.effective.configured} />}>
            <p className="mb-3 text-[12px] text-[#9ca3af]">
              The Facebook app that workspaces connect their Pages and Instagram accounts through. Webhook callback URL: <span className="font-mono text-white">{s.meta.callbackUrl}</span>
              {s.meta.effective.webhookConfigured ? "" : " · set a verify token so Meta can confirm the webhook"}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <FieldLabel>App ID</FieldLabel>
                <OsInput value={meta.appId} onChange={(e) => setMeta((f) => ({ ...f, appId: e.target.value }))} placeholder="1234567890" className="mt-1 w-full" />
              </label>
              <label className="block">
                <FieldLabel>App secret {s.meta.hasAppSecret ? "(blank keeps the saved secret)" : ""}</FieldLabel>
                <OsInput type="password" value={meta.appSecret} onChange={(e) => setMeta((f) => ({ ...f, appSecret: e.target.value }))} placeholder={s.meta.hasAppSecret ? "••••••••" : "app secret"} className="mt-1 w-full" autoComplete="off" />
              </label>
              <label className="block">
                <FieldLabel>Webhook verify token</FieldLabel>
                <OsInput value={meta.webhookVerifyToken} onChange={(e) => setMeta((f) => ({ ...f, webhookVerifyToken: e.target.value }))} placeholder="any long random string" className="mt-1 w-full" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <OsButton tone="primary" disabled={busy !== null} onClick={() => void save("Meta app saved", { metaAppId: meta.appId || null, metaWebhookVerifyToken: meta.webhookVerifyToken || null, ...(meta.appSecret ? { metaAppSecret: meta.appSecret } : {}) }, () => setMeta((f) => ({ ...f, appSecret: "" })))}>
                Save Meta app
              </OsButton>
              <OsButton disabled={busy !== null || (!meta.appId && !s.meta.effective.configured)} onClick={() => void test("meta", { target: "meta", ...(meta.appId ? { meta: { appId: meta.appId, ...(meta.appSecret ? { appSecret: meta.appSecret } : {}) } } : {}) })}>
                {busy === "test:meta" ? "Testing…" : "Test credentials"}
              </OsButton>
              {(s.meta.appId || s.meta.hasAppSecret) && (
                <OsButton tone="danger" disabled={busy !== null} onClick={() => void save("Meta app removed", { metaAppId: "", metaAppSecret: "", metaWebhookVerifyToken: "" })}>
                  Remove
                </OsButton>
              )}
            </div>
            <TestLine result={tests.meta ?? null} />
          </OsPanel>

          <OsPanel
            title="Default Actors · which Apify Actor does each job"
            actions={
              <OsButton disabled={busy !== null} onClick={() => void seedActors()}>
                {busy === "seed" ? "Adding…" : "Add the recommended set"}
              </OsButton>
            }
          >
            <p className="mb-3 text-[12px] text-[#9ca3af]">With a token saved above and these rows in place, discovery, enrichment and content search work for every workspace. &ldquo;Add the recommended set&rdquo; creates the standard Actors (Google search for Instagram / Facebook, Instagram search, Facebook page search, hashtags, profile and Facebook page enrichment) and never touches rows you already have. Each seeded Actor is capped at $0.10 per run (editable per row); the cap is enforced by Apify for pay-per-event Actors.</p>
            <div data-template="classic" className="dark">
              <ProvidersSettings key={actorsVersion} scope="platform" />
            </div>
          </OsPanel>
        </div>
      )}
    </>
  );
}

function StatusCard({ label, origin, configured, hint }: { label: string; origin: Origin; configured: boolean; hint: string }) {
  return (
    <div className="border border-[#1f2937] bg-[#0f131c] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">{label}</p>
      <p className={`mt-2 font-mono text-lg font-bold ${configured ? "text-pop-green" : "text-bauhaus-red"}`}>{configured ? "READY" : "NOT SET"}</p>
      <p className="mt-1 truncate text-[12px] text-[#9ca3af]" title={hint}>
        {hint}
        {configured && origin === "environment" ? " · from server env" : ""}
      </p>
    </div>
  );
}
