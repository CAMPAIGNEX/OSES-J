"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Globe, Copy, Link2, Plug, RefreshCw, Trash2, Unplug, CheckCircle2, AlertTriangle, KeyRound } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { useSession, PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, StatusBadge, Switch, Textarea, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

const SECTIONS = [
  { href: "/settings", label: "Account" },
  { href: "/settings/company", label: "Company" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/social", label: "Social accounts" },
  { href: "/settings/messaging", label: "Messaging" },
  { href: "/settings/ai", label: "AI" },
  { href: "/settings/automation", label: "Automation" },
  { href: "/settings/providers", label: "Providers" },
];

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="animate-in">
      <PageHeader title="Settings" />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Settings">
          {SECTIONS.map((s) => {
            const active = pathname === s.href;
            return (
              <Link key={s.href} href={s.href} data-ui="nav-link" aria-current={active ? "page" : undefined} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium", active ? "nav-active" : "text-muted hover:bg-surface-2 hover:text-body")}>
                {s.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </div>
  );
}

function useSaver() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  async function save(fn: () => Promise<void>, success = "Saved") {
    setSaving(true);
    setErrors({});
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors());
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  return { save, saving, errors };
}

// ---------- Account ----------

export function AccountSettings() {
  const session = useSession();
  const { save, saving } = useSaver();
  const [name, setName] = useState(session.user.name);
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const pwSaver = useSaver();
  return (
    <>
      <Card>
        <CardHeader title="Profile" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email"><Input value={session.user.email} disabled /></Field>
        </div>
        <Button className="mt-3" loading={saving} onClick={() => void save(async () => { await api("/api/settings/account", { method: "PUT", body: { name } }); window.location.reload(); })}>Save profile</Button>
      </Card>
      <Card>
        <CardHeader title="Password" description="Changing your password signs out other sessions." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Current password" error={pwSaver.errors.currentPassword}><Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} /></Field>
          <Field label="New password" error={pwSaver.errors.newPassword}><Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} /></Field>
        </div>
        <Button className="mt-3" variant="outline" loading={pwSaver.saving} onClick={() => void pwSaver.save(async () => { await api("/api/settings/password", { body: pw }); setPw({ currentPassword: "", newPassword: "" }); }, "Password changed")}>Change password</Button>
      </Card>
      <Card>
        <CardHeader title="Organization" />
        <p className="text-[13px] text-muted">You are <b>{session.organization.role.toLowerCase()}</b> of <b>{session.organization.name}</b>.</p>
      </Card>
    </>
  );
}

// ---------- Company ----------

interface Company { name: string; description: string | null; website: string | null; country: string | null; city: string | null; address: string | null; products: string | null; moq: string | null; certifications: string | null; shippingInfo: string | null; productionCapacity: string | null; contactEmail: string | null; contactPhone: string | null; timezone: string }

export function CompanySettings() {
  const { data, loading } = useQuery<{ company: Company }>("/api/settings/company");
  const { save, saving, errors } = useSaver();
  const [form, setForm] = useState<Company | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data.company);
  }, [data, form]);
  if (loading || !form) return <Skeleton className="h-64" />;
  const f = <K extends keyof Company>(k: K) => ({ value: (form[k] ?? "") as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((x) => (x ? { ...x, [k]: e.target.value } : x)) });
  return (
    <Card>
      <CardHeader title="Company profile" description="These are the verified facts the AI is allowed to state. Leave a field empty rather than guessing — the AI will say a team member will confirm." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company name" error={errors.name} className="sm:col-span-2"><Input {...f("name")} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea {...f("description")} className="min-h-[80px]" placeholder="Manufacturer and exporter of custom sportswear…" /></Field>
        <Field label="Website" error={errors.website}><Input {...f("website")} placeholder="https://" /></Field>
        <Field label="Timezone" description="IANA zone used as your working-hours reference"><Input {...f("timezone")} placeholder="Asia/Karachi" /></Field>
        <Field label="Country"><Input {...f("country")} /></Field>
        <Field label="City"><Input {...f("city")} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input {...f("address")} /></Field>
        <Field label="Products" className="sm:col-span-2"><Textarea {...f("products")} className="min-h-[70px]" placeholder="Custom sportswear, hoodies, tracksuits, gym wear, jerseys…" /></Field>
        <Field label="MOQ"><Input {...f("moq")} placeholder="500 units per style" /></Field>
        <Field label="Production capacity"><Input {...f("productionCapacity")} placeholder="50,000 pieces / month" /></Field>
        <Field label="Certifications" className="sm:col-span-2"><Input {...f("certifications")} placeholder="Only list certifications you actually hold" /></Field>
        <Field label="Shipping information" className="sm:col-span-2"><Textarea {...f("shippingInfo")} className="min-h-[60px]" /></Field>
        <Field label="Contact email"><Input {...f("contactEmail")} /></Field>
        <Field label="Contact phone"><Input {...f("contactPhone")} /></Field>
      </div>
      <Button className="mt-4" loading={saving} onClick={() => void save(async () => { await api("/api/settings/company", { method: "PUT", body: form }); })}>Save company profile</Button>
    </Card>
  );
}

// ---------- Social ----------

interface Connection { id: string; platform: string; provider: string; username: string | null; displayName: string | null; status: string; hasToken: boolean; createdAt: string; lastError: string | null }

export function SocialSettings() {
  const params = useSearchParams();
  const toast = useToast();
  const list = useQuery<{ items: Connection[]; metaConfigured: boolean; webhookConfigured: boolean }>("/api/social");
  useEffect(() => {
    const err = params.get("error");
    const connected = params.get("connected");
    const warning = params.get("warning");
    if (err) toast.error("Meta connection failed", err);
    else if (connected) toast.success(`Connected ${connected} account${connected === "1" ? "" : "s"}`, warning ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <Card>
        <CardHeader title="Meta (Instagram & Facebook)" description="Connect Facebook Pages and the Instagram professional accounts linked to them through the official Meta API. OSES J never asks for your Facebook password." actions={list.data?.metaConfigured ? <Button href="/api/social/meta/connect" icon={<Plug className="h-4 w-4" />}>Connect with Facebook</Button> : undefined} />
        {list.data && !list.data.metaConfigured && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Meta app credentials are not configured on the server (META_APP_ID / META_APP_SECRET). See docs/meta-integration.md.</p>
          </div>
        )}
        {list.data?.items.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {list.data.items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                <Badge tone="brand">{titleCase(c.platform)}</Badge>
                <span className="font-medium">{c.displayName ?? c.username ?? c.id}</span>
                {c.username && <span className="text-muted">@{c.username}</span>}
                <StatusBadge status={c.status} />
                <span className="text-xs text-faint">connected {formatDateTime(c.createdAt)}</span>
                {c.lastError && <span className="text-xs text-red-600">{c.lastError}</span>}
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void api(`/api/social/${c.id}`, { method: "DELETE" }).then(() => list.refetch())} icon={<Unplug className="h-3.5 w-3.5" />}>Disconnect</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{list.loading ? "Loading…" : "No accounts connected."}</p>
        )}
        <p className="mt-3 text-xs text-faint">The official API can reply to people who message your Page/Instagram account. It cannot cold-message arbitrary profiles — for first contact OSES J uses the browser extension, Apify automation, or manual sending.</p>
      </Card>
      <Card>
        <CardHeader title="Webhooks" description="Incoming messages, delivery and read receipts arrive through the Meta webhook." />
        <p className="text-[13px] text-muted">Callback URL: <code className="rounded bg-surface-2 px-1.5 py-0.5">{typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/meta` : "/api/webhooks/meta"}</code> · verify token: <code className="rounded bg-surface-2 px-1.5 py-0.5">META_WEBHOOK_VERIFY_TOKEN</code> {list.data?.webhookConfigured ? <Badge tone="success" className="ml-1">configured</Badge> : <Badge tone="warning" className="ml-1">not configured</Badge>}</p>
      </Card>
    </>
  );
}

// ---------- Messaging ----------

interface MessagingSettings { defaultChannel: string; messagingMode: string; autopilotEnabled: boolean; workingHours: { enabled: boolean; start: string; end: string; days?: number[]; timezoneMode: string; customTimezone: string | null }; followUpDays: number[]; messagesPerHour: number; messagesPerDay: number; minMinutesBetweenMessages: number }

export function MessagingSettingsPage() {
  const { data, loading } = useQuery<{ settings: MessagingSettings }>("/api/settings/messaging");
  const { save, saving } = useSaver();
  const [form, setForm] = useState<MessagingSettings | null>(null);
  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);
  if (loading || !form) return <Skeleton className="h-64" />;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return (
    <>
      <Card>
        <CardHeader title="Messaging" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Default channel"><Select value={form.defaultChannel} onChange={(e) => setForm({ ...form, defaultChannel: e.target.value })}><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option></Select></Field>
          <Field label="Mode" description={form.autopilotEnabled ? "Autopilot is currently ON (AI Assistant)." : "Autopilot must also be switched on in the AI Assistant."}><Select value={form.messagingMode} onChange={(e) => setForm({ ...form, messagingMode: e.target.value })}><option value="MANUAL">Manual</option><option value="COPILOT">Copilot</option><option value="AUTOPILOT">Autopilot</option></Select></Field>
          <Field label="Follow-up schedule (days after first message)" description="Comma separated, e.g. 3, 7, 14" className="sm:col-span-2"><Input value={form.followUpDays.join(", ")} onChange={(e) => setForm({ ...form, followUpDays: e.target.value.split(",").map((x) => Number(x.trim())).filter((n) => n > 0) })} /></Field>
          <Field label="Messages per hour"><Input type="number" min={1} value={form.messagesPerHour} onChange={(e) => setForm({ ...form, messagesPerHour: Number(e.target.value) })} /></Field>
          <Field label="Messages per day"><Input type="number" min={1} value={form.messagesPerDay} onChange={(e) => setForm({ ...form, messagesPerDay: Number(e.target.value) })} /></Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Working hours" description="Automated messages are held until the next working slot in the chosen timezone. Manual sends are never blocked." />
        <div className="space-y-3">
          <Switch checked={form.workingHours.enabled} onChange={(v) => setForm({ ...form, workingHours: { ...form.workingHours, enabled: v } })} label="Only send automated messages during working hours" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Start"><Input type="time" value={form.workingHours.start} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, start: e.target.value } })} /></Field>
            <Field label="End"><Input type="time" value={form.workingHours.end} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, end: e.target.value } })} /></Field>
            <Field label="Timezone reference"><Select value={form.workingHours.timezoneMode} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, timezoneMode: e.target.value } })}><option value="client">Client&apos;s local time</option><option value="exporter">My company time</option><option value="custom">Custom timezone</option></Select></Field>
            {form.workingHours.timezoneMode === "custom" && <Field label="Custom timezone"><Input value={form.workingHours.customTimezone ?? ""} onChange={(e) => setForm({ ...form, workingHours: { ...form.workingHours, customTimezone: e.target.value } })} placeholder="Europe/Berlin" /></Field>}
          </div>
          <div className="flex flex-wrap gap-2">
            {days.map((d, i) => {
              const on = (form.workingHours.days ?? [1, 2, 3, 4, 5]).includes(i);
              return (
                <button key={d} type="button" onClick={() => { const cur = new Set(form.workingHours.days ?? [1, 2, 3, 4, 5]); if (cur.has(i)) cur.delete(i); else cur.add(i); setForm({ ...form, workingHours: { ...form.workingHours, days: [...cur].sort() } }); }} className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "border-default text-muted")}>{d}</button>
              );
            })}
          </div>
        </div>
      </Card>
      <Button loading={saving} onClick={() => void save(async () => { await api("/api/settings/messaging", { method: "PUT", body: form }); })}>Save messaging settings</Button>
    </>
  );
}

// ---------- Automation ----------

interface Status { mode: string; queueDriver: string; jobs: Record<string, number>; messageJobs: Record<string, number>; extension: { enabled: boolean; online: boolean; devices: Array<{ id: string; name: string; browser: string | null; extensionVersion: string | null; status: string; lastSeenAt: string | null; lastStatus: string | null }> }; apify: { configured: boolean; origin: string | null; tokenPreview: string | null; enabled: boolean; providerConfigs: number }; ai: { provider: string | null; model: string | null; configured: boolean }; limits: { maxConcurrentJobs: number; maxRetries: number; jobTimeoutSec: number; preferredProvider: string } }

export function AutomationSettings() {
  const toast = useToast();
  const status = useQuery<Status>("/api/automation/status", { refreshInterval: 10_000 });
  const { save, saving } = useSaver();
  const [pairing, setPairing] = useState<{ code: string; expiresAt: string } | null>(null);
  const [apifyToken, setApifyToken] = useState("");
  const [test, setTest] = useState<{ ok: boolean; account?: string; error?: string } | null>(null);
  const [limits, setLimits] = useState<Status["limits"] | null>(null);
  useEffect(() => {
    if (status.data && !limits) setLimits(status.data.limits);
  }, [status.data, limits]);
  const s = status.data;
  return (
    <>
      <Card>
        <CardHeader title="Browser automation" description="The OSES J Chrome extension sends messages from your own logged-in browser. Nothing about your Instagram/Facebook login is shared with the server." actions={<Switch checked={s?.extension.enabled ?? true} onChange={(v) => void save(async () => { await api("/api/settings/automation", { method: "PUT", body: { extensionEnabled: v } }); await status.refetch(); })} label="Enabled" />} />
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className={cn("inline-flex items-center gap-2 font-medium", s?.extension.online ? "text-emerald-600" : "text-muted")}>
            <span className={cn("h-2.5 w-2.5 rounded-full", s?.extension.online ? "bg-emerald-500" : "bg-slate-400")} /> Extension: {s?.extension.online ? "Connected" : "Offline"}
          </span>
          <Button size="sm" variant="outline" onClick={() => void api<{ code: string; expiresAt: string }>("/api/extension/pairing", { method: "POST" }).then(setPairing)} icon={<Link2 className="h-3.5 w-3.5" />}>{s?.extension.devices.length ? "Pair another browser" : "Pair extension"}</Button>
          <Button size="sm" variant="ghost" onClick={() => void status.refetch()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Refresh</Button>
        </div>
        {pairing && (
          <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/60 p-3 text-[13px] dark:border-brand-800 dark:bg-brand-900/20">
            <p>Open the OSES J extension, enter the server URL <code className="rounded bg-surface px-1">{typeof window !== "undefined" ? window.location.origin : ""}</code> and this pairing code (valid 10 minutes):</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="rounded-md bg-surface px-3 py-1.5 font-mono text-lg tracking-[0.3em]">{pairing.code}</code>
              <Button size="xs" variant="ghost" onClick={() => { void navigator.clipboard.writeText(pairing.code); toast.info("Copied"); }} icon={<Copy className="h-3.5 w-3.5" />}>Copy</Button>
            </div>
          </div>
        )}
        {s?.extension.devices.length ? (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {s.extension.devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                <Globe className="h-4 w-4 text-faint" />
                <span className="font-medium">{d.name}</span>
                <span className="text-xs text-muted">{d.browser ?? ""} {d.extensionVersion ? `v${d.extensionVersion}` : ""}</span>
                <StatusBadge status={d.status} />
                <span className="text-xs text-faint">{d.lastSeenAt ? `seen ${timeAgo(d.lastSeenAt)}` : "never seen"}{d.lastStatus ? ` · ${d.lastStatus}` : ""}</span>
                <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void api(`/api/extension/devices/${d.id}`, { method: "DELETE" }).then(() => status.refetch())} icon={<Trash2 className="h-3.5 w-3.5" />}>Revoke</Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[13px] text-muted">No browser paired yet. Build the extension (`pnpm extension:build`), load `apps/extension/dist` in Chrome, then pair it here.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Apify" description="Used for lead discovery, profile enrichment and (optionally) DM automation." actions={<Switch checked={s?.apify.enabled ?? true} onChange={(v) => void save(async () => { await api("/api/settings/automation", { method: "PUT", body: { apifyEnabled: v } }); await status.refetch(); })} label="Enabled" />} />
        <p className="text-[13px] text-muted">
          Token: {s?.apify.configured ? <span className="text-emerald-600"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />configured ({s.apify.origin === "organization" ? "organization key" : "platform key"} {s.apify.tokenPreview})</span> : <span className="text-amber-600">not configured</span>} · {s?.apify.providerConfigs ?? 0} provider configuration{s?.apify.providerConfigs === 1 ? "" : "s"} · <Link href="/settings/providers" className="text-brand-600 hover:underline">manage Actors</Link>
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <Field label="Organization Apify token" description="Stored encrypted. Overrides the platform token." className="min-w-[260px] flex-1"><Input type="password" value={apifyToken} onChange={(e) => setApifyToken(e.target.value)} placeholder="apify_api_…" autoComplete="off" /></Field>
          <Button loading={saving} disabled={!apifyToken} onClick={() => void save(async () => { await api("/api/settings/automation", { method: "PUT", body: { apifyToken } }); setApifyToken(""); await status.refetch(); }, "Apify token saved")} icon={<KeyRound className="h-4 w-4" />}>Save token</Button>
          <Button variant="outline" onClick={() => void api<typeof test>("/api/settings/providers/test", { body: {} }).then(setTest)}>Test connection</Button>
        </div>
        {test && <p className={cn("mt-2 text-[13px]", test.ok ? "text-emerald-600" : "text-red-600")}>{test.ok ? `Connected as ${test.account}` : test.error}</p>}
      </Card>

      <Card>
        <CardHeader title="Job system" description={`Mode: ${s?.mode ?? "…"} · queue driver: ${s?.queueDriver ?? "…"}`} />
        <div className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Automation jobs</p>
            <p className="text-muted">{s ? Object.entries(s.jobs).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ") : "…"}</p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-faint">Message delivery jobs</p>
            <p className="text-muted">{s && Object.keys(s.messageJobs).length ? Object.entries(s.messageJobs).map(([k, v]) => `${k.toLowerCase()} ${v}`).join(" · ") : "none yet"}</p>
          </div>
        </div>
        {limits && (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <Field label="Preferred provider"><Select value={limits.preferredProvider} onChange={(e) => setLimits({ ...limits, preferredProvider: e.target.value })}><option value="auto">Auto (official → extension → Apify)</option><option value="meta">Official Meta API only</option><option value="extension">Browser extension only</option><option value="apify">Apify only</option><option value="manual">Manual only</option></Select></Field>
            <Field label="Concurrent jobs"><Input type="number" min={1} value={limits.maxConcurrentJobs} onChange={(e) => setLimits({ ...limits, maxConcurrentJobs: Number(e.target.value) })} /></Field>
            <Field label="Retries"><Input type="number" min={0} value={limits.maxRetries} onChange={(e) => setLimits({ ...limits, maxRetries: Number(e.target.value) })} /></Field>
            <Field label="Job timeout (s)"><Input type="number" min={30} value={limits.jobTimeoutSec} onChange={(e) => setLimits({ ...limits, jobTimeoutSec: Number(e.target.value) })} /></Field>
            <div className="sm:col-span-4"><Button loading={saving} onClick={() => void save(async () => { await api("/api/settings/automation", { method: "PUT", body: limits }); await status.refetch(); })}>Save job settings</Button></div>
          </div>
        )}
        <p className="mt-3 text-xs text-faint">In <b>inline</b> mode jobs run inside the web app right after they are created. On shared hosting you can also call <code>POST /api/internal/jobs/tick</code> from cron; on a VPS run <code>pnpm worker</code>.</p>
      </Card>
    </>
  );
}

// ---------- Providers ----------

interface ProviderRow { id: string; domain: string; platform: string; actorId: string; adapter: string; enabled: boolean; priority: number; timeoutSec: number; costLimitUsd: number | null; scope: string; settings: Record<string, unknown> | null }
interface ProvidersData { items: ProviderRow[]; environmentDefaults: Array<{ domain: string; platform: string; actorId: string; adapter: string; priority: number }>; adapters: Array<{ key: string; platform: string; purposes: string[]; defaultActorId: string; description: string }> }

export function ProvidersSettings() {
  const toast = useToast();
  const data = useQuery<ProvidersData>("/api/settings/providers");
  const [form, setForm] = useState({ domain: "DISCOVERY", platform: "INSTAGRAM", adapter: "search-engine-instagram", actorId: "apify/google-search-scraper", priority: 1, timeoutSec: 600, settings: "" });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, string>>({});
  async function create() {
    setSaving(true);
    try {
      let settings: Record<string, unknown> = {};
      if (form.settings.trim()) settings = JSON.parse(form.settings) as Record<string, unknown>;
      await api("/api/settings/providers", { body: { domain: form.domain, provider: "apify", platform: form.platform, actorId: form.actorId, adapter: form.adapter, enabled: true, priority: form.priority, timeoutSec: form.timeoutSec, settings } });
      toast.success("Provider added");
      await data.refetch();
    } catch (err) {
      toast.error("Could not add provider", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  async function testActor(actorId: string) {
    setTesting(actorId);
    try {
      const r = await api<{ ok: boolean; actor?: { name: string; deprecated: boolean } | null; error?: string }>("/api/settings/providers/test", { body: { actorId } });
      setTestResult((t) => ({ ...t, [actorId]: r.ok ? `OK: ${r.actor?.name ?? actorId}${r.actor?.deprecated ? " (deprecated!)" : ""}` : r.error ?? "failed" }));
    } finally {
      setTesting(null);
    }
  }
  return (
    <>
      <Card>
        <CardHeader title="Provider configuration" description="Which Apify Actor handles each job. Organization rows override platform defaults from the environment. Actors are external providers — verify the input/output schema of the Actor you choose." />
        {data.data ? (
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-wide text-muted"><th className="py-1.5">Domain</th><th>Platform</th><th>Actor</th><th>Adapter</th><th>Priority</th><th>Scope</th><th></th></tr></thead>
            <tbody>
              {data.data.items.map((p) => (
                <tr key={p.id} className="border-t border-default">
                  <td className="py-2">{titleCase(p.domain)}</td>
                  <td>{titleCase(p.platform)}</td>
                  <td className="font-mono text-xs">{p.actorId}</td>
                  <td>{p.adapter}</td>
                  <td>{p.priority}</td>
                  <td><Badge tone={p.scope === "organization" ? "brand" : "neutral"}>{p.scope}</Badge>{!p.enabled && <Badge tone="warning" className="ml-1">disabled</Badge>}</td>
                  <td className="text-right">
                    <Button size="xs" variant="ghost" loading={testing === p.actorId} onClick={() => void testActor(p.actorId)}>Test</Button>
                    {p.scope === "organization" && <Button size="xs" variant="ghost" onClick={() => void api(`/api/settings/providers/${p.id}`, { method: "DELETE" }).then(() => data.refetch())} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Delete" />}
                    {testResult[p.actorId] && <p className="text-xs text-muted">{testResult[p.actorId]}</p>}
                  </td>
                </tr>
              ))}
              {data.data.environmentDefaults.map((d, i) => (
                <tr key={`env-${i}`} className="border-t border-default text-muted">
                  <td className="py-2">{titleCase(d.domain)}</td>
                  <td>{titleCase(d.platform)}</td>
                  <td className="font-mono text-xs">{d.actorId}</td>
                  <td>{d.adapter}</td>
                  <td>{d.priority}</td>
                  <td><Badge>environment</Badge></td>
                  <td className="text-right"><Button size="xs" variant="ghost" loading={testing === d.actorId} onClick={() => void testActor(d.actorId)}>Test</Button>{testResult[d.actorId] && <p className="text-xs text-muted">{testResult[d.actorId]}</p>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <Skeleton className="h-32" />}
      </Card>
      <Card>
        <CardHeader title="Add provider configuration" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Domain"><Select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}><option value="DISCOVERY">Discovery</option><option value="ENRICHMENT">Enrichment (profile details)</option><option value="CONTENT">Content (posts)</option><option value="MESSAGING">Messaging (DM automation)</option></Select></Field>
          <Field label="Platform"><Select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option><option value="ANY">Any</option></Select></Field>
          <Field label="Adapter"><Select value={form.adapter} onChange={(e) => { const a = data.data?.adapters.find((x) => x.key === e.target.value); setForm({ ...form, adapter: e.target.value, actorId: a?.defaultActorId || form.actorId }); }}>{data.data?.adapters.map((a) => <option key={a.key} value={a.key}>{a.key} — {a.description}</option>)}</Select></Field>
          <Field label="Actor ID" description="username/actor-name"><Input value={form.actorId} onChange={(e) => setForm({ ...form, actorId: e.target.value })} /></Field>
          <Field label="Priority"><Input type="number" min={1} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} /></Field>
          <Field label="Timeout (s)"><Input type="number" min={30} value={form.timeoutSec} onChange={(e) => setForm({ ...form, timeoutSec: Number(e.target.value) })} /></Field>
          <Field label="Settings (JSON)" description='e.g. {"inputOverrides":{"resultsLimit":5}} or, for generic adapters, {"inputTemplate":{...}}' className="sm:col-span-2 lg:col-span-3"><Textarea value={form.settings} onChange={(e) => setForm({ ...form, settings: e.target.value })} className="min-h-[70px] font-mono text-xs" placeholder="{}" /></Field>
        </div>
        <Button className="mt-3" loading={saving} onClick={() => void create()}>Add provider</Button>
      </Card>
    </>
  );
}
