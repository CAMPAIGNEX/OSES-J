"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bot, Check, FileText, Plus, Power, Trash2, Upload, X, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, StatusBadge, Switch, Textarea, cn } from "@/components/ui/primitives";
import { Dialog, Tabs, useToast } from "@/components/ui/overlay";

interface AISettings {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  platformDefault: { provider: string; model: string | null } | null;
  temperature: number;
  tone: string | null;
  language: string | null;
  messagingMode: string;
  autopilotEnabled: boolean;
  autopilotEnabledAt: string | null;
  autoReply: boolean;
  autoFollowUp: boolean;
  autoFirstMessage: boolean;
  requireApprovalFirstMessage: boolean;
  requireApprovalAttachments: boolean;
  confidenceThreshold: number;
  escalatePricing: boolean;
  escalateNegotiation: boolean;
  escalateComplaints: boolean;
  escalateUnusual: boolean;
}
interface Instruction {
  id: string;
  kind: string;
  title: string;
  content: string;
  enabled: boolean;
}
interface KnowledgeDoc {
  id: string;
  title: string;
  sourceType: string;
  status: string;
  charCount: number;
  chunkCount: number;
  error: string | null;
  createdAt: string;
}
interface ActionLog {
  id: string;
  action: string;
  status: string;
  triggeredBy: string;
  model: string | null;
  confidence: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
  client: { cid: string; brandName: string } | null;
  decision: unknown;
}

const KINDS = ["COMPANY", "PRODUCTS", "TONE", "RULES", "PROHIBITED", "ESCALATION", "WORKING_HOURS", "CUSTOM"];
type Tab = "autopilot" | "instructions" | "knowledge" | "activity";

export function AIAssistant() {
  const params = useSearchParams();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "autopilot");
  const settings = useQuery<{ settings: AISettings }>("/api/ai/settings");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const s = settings.data?.settings;

  async function update(patch: Record<string, unknown>, success = "Saved") {
    setBusy("settings");
    try {
      const res = await api<{ settings: AISettings }>("/api/ai/settings", { method: "PUT", body: patch });
      settings.setData(res);
      toast.success(success);
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }
  async function toggleAutopilot(enabled: boolean) {
    setBusy("autopilot");
    try {
      await api("/api/ai/autopilot", { body: { enabled, confirmed: enabled } });
      await settings.refetch();
      toast.success(enabled ? "AI Autopilot is ON" : "AI Autopilot is OFF");
      setConfirmOpen(false);
    } catch (err) {
      toast.error("Could not change autopilot", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="animate-in">
      <PageHeader title="AI Assistant" description="Teach the AI about your company, decide what it may do on its own, and review everything it did." />
      <Card className={cn("mb-5 border-2", s?.autopilotEnabled ? "border-brand-400" : "border-default")}>
        <div className="flex flex-wrap items-center gap-4">
          <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", s?.autopilotEnabled ? "bg-brand-500 text-white" : "bg-surface-2 text-muted")}>
            <Bot className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">AI Autopilot</p>
            <p className="text-2xl font-semibold">{settings.loading && !s ? "…" : s?.autopilotEnabled ? "ON" : "OFF"}</p>
            <p className="text-[13px] text-muted">
              {s?.autopilotEnabled ? `Enabled ${s.autopilotEnabledAt ? formatDateTime(s.autopilotEnabledAt) : ""}. The AI acts within the limits below and logs every action.` : `Mode: ${s ? titleCase(s.messagingMode) : "—"}. The AI drafts and suggests; nothing is sent without you.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {s?.autopilotEnabled ? (
              <Button variant="danger" loading={busy === "autopilot"} onClick={() => void toggleAutopilot(false)} icon={<Power className="h-4 w-4" />}>
                Pause AI
              </Button>
            ) : (
              <Button loading={busy === "autopilot"} onClick={() => setConfirmOpen(true)} icon={<Power className="h-4 w-4" />}>
                Turn on Autopilot
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: "autopilot", label: "Behaviour & limits" }, { value: "instructions", label: "Company instructions" }, { value: "knowledge", label: "Knowledge base" }, { value: "activity", label: "AI activity log" }]} />

      {tab === "autopilot" && s && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Messaging mode" description="Manual: you send everything. Copilot: AI suggests, you approve. Autopilot: AI may act within the rules." />
            <Select value={s.messagingMode} onChange={(e) => void api("/api/settings/messaging", { method: "PUT", body: { messagingMode: e.target.value } }).then(() => settings.refetch()).then(() => toast.success("Mode updated"))}>
              <option value="MANUAL">Manual</option>
              <option value="COPILOT">Copilot</option>
              <option value="AUTOPILOT">Autopilot (requires the switch above)</option>
            </Select>
            <div className="mt-4 space-y-3">
              <Switch checked={s.autoFirstMessage} onChange={(v) => void update({ autoFirstMessage: v })} label="Auto first message" description="Autopilot may send the first contact for campaign leads without approval (unless approval is required below)." />
              <Switch checked={s.autoReply} onChange={(v) => void update({ autoReply: v })} label="Auto-reply" description="Reply to incoming messages automatically when intent is clear and no escalation rule applies." />
              <Switch checked={s.autoFollowUp} onChange={(v) => void update({ autoFollowUp: v })} label="Auto follow-up" description="Send follow-ups on the configured schedule when a prospect has not replied." />
            </div>
          </Card>
          <Card>
            <CardHeader title="Human control" description="These always win over autopilot." />
            <div className="space-y-3">
              <Switch checked={s.requireApprovalFirstMessage} onChange={(v) => void update({ requireApprovalFirstMessage: v })} label="Require approval for first messages" />
              <Switch checked={s.requireApprovalAttachments} onChange={(v) => void update({ requireApprovalAttachments: v })} label="Require approval for attachments" />
              <Field label={`Confidence threshold: ${Math.round(s.confidenceThreshold * 100)}%`} description="Below this confidence the AI asks for human review instead of acting.">
                <input type="range" min={0.3} max={1} step={0.05} value={s.confidenceThreshold} onChange={(e) => void update({ confidenceThreshold: Number(e.target.value) })} className="w-full accent-brand-500" />
              </Field>
              <p className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-faint">Always escalate to a human</p>
              <Switch checked={s.escalatePricing} onChange={(v) => void update({ escalatePricing: v })} label="Pricing questions" />
              <Switch checked={s.escalateNegotiation} onChange={(v) => void update({ escalateNegotiation: v })} label="Negotiation" />
              <Switch checked={s.escalateComplaints} onChange={(v) => void update({ escalateComplaints: v })} label="Complaints" />
              <Switch checked={s.escalateUnusual} onChange={(v) => void update({ escalateUnusual: v })} label="Unusual or unclear requests" />
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="AI provider & style" description="Which model writes for you, and how." />
            <ProviderForm settings={s} onSave={(patch) => update(patch, "AI provider updated")} saving={busy === "settings"} />
          </Card>
        </div>
      )}

      {tab === "instructions" && <InstructionsPanel />}
      {tab === "knowledge" && <KnowledgePanel />}
      {tab === "activity" && <ActivityPanel />}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Turn on AI Autopilot?"
        description="Please confirm what the AI will be allowed to do."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button loading={busy === "autopilot"} onClick={() => void toggleAutopilot(true)} icon={<ShieldCheck className="h-4 w-4" />}>I understand, turn it on</Button>
          </>
        }
      >
        {s && (
          <div className="grid gap-4 sm:grid-cols-2 text-[13px]">
            <div>
              <p className="mb-2 font-semibold text-emerald-700 dark:text-emerald-300">AI may</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> Generate first messages{s.requireApprovalFirstMessage ? " (sent only after your approval)" : s.autoFirstMessage ? " and send them" : " for your approval"}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {s.autoReply ? "Reply to incoming messages automatically" : "Draft replies for your approval"}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> {s.autoFollowUp ? "Schedule and send follow-ups" : "Suggest follow-ups"}</li>
                <li className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-emerald-500" /> Classify intent and update client status</li>
              </ul>
            </div>
            <div>
              <p className="mb-2 font-semibold text-red-700 dark:text-red-300">AI may not</p>
              <ul className="space-y-1.5">
                <li className="flex gap-2"><X className="h-4 w-4 shrink-0 text-red-500" /> Change company information or settings</li>
                <li className="flex gap-2"><X className="h-4 w-4 shrink-0 text-red-500" /> Invent prices, MOQ, certifications or delivery dates</li>
                <li className="flex gap-2"><X className="h-4 w-4 shrink-0 text-red-500" /> {s.escalateNegotiation ? "Negotiate prices — escalated to you" : "Make unsupported claims"}</li>
                <li className="flex gap-2"><X className="h-4 w-4 shrink-0 text-red-500" /> Contact anyone marked do-not-contact or outside working hours</li>
                <li className="flex gap-2"><X className="h-4 w-4 shrink-0 text-red-500" /> Exceed {`your hourly / daily message limits`}</li>
              </ul>
            </div>
            <p className="sm:col-span-2 text-xs text-faint">You can pause the AI at any time from this page. Every automated action is written to the AI activity log.</p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function ProviderForm({ settings, onSave, saving }: { settings: AISettings; onSave: (patch: Record<string, unknown>) => Promise<void>; saving: boolean }) {
  const [form, setForm] = useState({ provider: settings.provider, model: settings.model ?? "", baseUrl: settings.baseUrl ?? "", apiKey: "", tone: settings.tone ?? "", language: settings.language ?? "", temperature: settings.temperature });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Provider" description={settings.platformDefault ? `Platform default: ${settings.platformDefault.provider} (${settings.platformDefault.model ?? "default model"})` : "No platform default configured on the server."}>
        <Select value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}>
          <option value="platform_default">Platform default</option>
          <option value="anthropic">Anthropic (Claude)</option>
          <option value="openai">OpenAI</option>
          <option value="openai_compatible">OpenAI-compatible endpoint</option>
          <option value="none">Disabled</option>
        </Select>
      </Field>
      <Field label="Model" description="e.g. claude-opus-5">
        <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="claude-opus-5" />
      </Field>
      <Field label="API key" description={settings.hasApiKey ? `Stored encrypted (${settings.apiKeyPreview}). Leave blank to keep.` : "Stored encrypted; never shown again."}>
        <Input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={settings.hasApiKey ? "••••••••" : "sk-…"} autoComplete="off" />
      </Field>
      {form.provider === "openai_compatible" && (
        <Field label="Base URL" className="lg:col-span-3"><Input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://openrouter.ai/api/v1" /></Field>
      )}
      <Field label="Tone"><Input value={form.tone} onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))} placeholder="Professional, friendly, short" /></Field>
      <Field label="Language"><Input value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} placeholder="English" /></Field>
      <Field label={`Temperature ${form.temperature.toFixed(2)}`} description="Used by providers that support it (ignored by current Claude models).">
        <input type="range" min={0} max={1} step={0.05} value={form.temperature} onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))} className="w-full accent-brand-500" />
      </Field>
      <div className="sm:col-span-2 lg:col-span-3">
        <Button loading={saving} onClick={() => void onSave({ provider: form.provider, model: form.model || null, baseUrl: form.baseUrl || null, ...(form.apiKey ? { apiKey: form.apiKey } : {}), tone: form.tone || null, language: form.language || null, temperature: form.temperature })}>Save AI settings</Button>
      </div>
    </div>
  );
}

function InstructionsPanel() {
  const toast = useToast();
  const list = useQuery<{ items: Instruction[] }>("/api/ai/instructions");
  const [editing, setEditing] = useState<Partial<Instruction> | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!editing?.title || !editing.content) return;
    setSaving(true);
    try {
      if (editing.id) await api(`/api/ai/instructions/${editing.id}`, { method: "PATCH", body: { title: editing.title, content: editing.content, kind: editing.kind, enabled: editing.enabled ?? true } });
      else await api("/api/ai/instructions", { body: { title: editing.title, content: editing.content, kind: editing.kind ?? "CUSTOM", enabled: true } });
      setEditing(null);
      await list.refetch();
      toast.success("Instruction saved");
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Instructions" description="Loaded into every prompt for your organization. Company facts come from Settings → Company." actions={<Button size="sm" onClick={() => setEditing({ kind: "CUSTOM", enabled: true })} icon={<Plus className="h-3.5 w-3.5" />}>Add</Button>} />
        {list.loading && !list.data ? <Skeleton className="h-24" /> : list.data?.items.length ? (
          <ul className="space-y-2">
            {list.data.items.map((i) => (
              <li key={i.id} className={cn("rounded-lg border border-default p-3", !i.enabled && "opacity-60")}>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={i.kind === "PROHIBITED" ? "danger" : i.kind === "ESCALATION" ? "warning" : "brand"}>{titleCase(i.kind)}</Badge>
                  <span className="text-[13px] font-medium">{i.title}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Switch checked={i.enabled} onChange={(v) => void api(`/api/ai/instructions/${i.id}`, { method: "PATCH", body: { enabled: v } }).then(() => list.refetch())} />
                    <Button size="xs" variant="ghost" onClick={() => setEditing(i)}>Edit</Button>
                    <Button size="xs" variant="ghost" onClick={() => void api(`/api/ai/instructions/${i.id}`, { method: "DELETE" }).then(() => list.refetch())} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Delete" />
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] text-muted">{i.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">No instructions yet. Add your tone of voice, rules and things the AI must never say.</p>
        )}
      </Card>
      <Card>
        <CardHeader title={editing?.id ? "Edit instruction" : "New instruction"} />
        {editing ? (
          <div className="space-y-3">
            <Field label="Type"><Select value={editing.kind ?? "CUSTOM"} onChange={(e) => setEditing((x) => ({ ...x, kind: e.target.value }))}>{KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</Select></Field>
            <Field label="Title"><Input value={editing.title ?? ""} onChange={(e) => setEditing((x) => ({ ...x, title: e.target.value }))} /></Field>
            <Field label="Instruction"><Textarea value={editing.content ?? ""} onChange={(e) => setEditing((x) => ({ ...x, content: e.target.value }))} className="min-h-[180px]" placeholder={"Example:\nNever promise delivery dates.\nAlways mention that samples are available."} /></Field>
            <div className="flex gap-2"><Button loading={saving} onClick={() => void save()}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </div>
        ) : (
          <div className="space-y-2 text-[13px] text-muted">
            <p>Good instructions are short and specific:</p>
            <ul className="list-disc space-y-1 pl-4">
              <li><b>Tone:</b> professional, friendly, concise, B2B.</li>
              <li><b>Prohibited:</b> never quote prices; never invent certifications.</li>
              <li><b>Escalation:</b> negotiations and complaints go to a human.</li>
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}

function KnowledgePanel() {
  const toast = useToast();
  const list = useQuery<{ items: KnowledgeDoc[] }>("/api/ai/knowledge", { refreshInterval: 6000 });
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function addText() {
    setSaving(true);
    try {
      const res = await api<{ chunkCount: number }>("/api/ai/knowledge", { body: { title, content } });
      toast.success(`Added (${res.chunkCount} chunks)`);
      setTitle("");
      setContent("");
      await list.refetch();
    } catch (err) {
      toast.error("Could not add", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  async function upload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("addToKnowledge", "true");
      fd.append("kind", "KNOWLEDGE");
      await api("/api/documents", { body: fd, raw: true, method: "POST" });
      toast.success("Uploaded; processing in the background");
      await list.refetch();
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card>
        <CardHeader title="Knowledge documents" description="Product sheets, MOQ tables, FAQs. Retrieved per message so the AI only states facts you provided." />
        {list.data?.items.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {list.data.items.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                <FileText className="h-4 w-4 text-faint" />
                <span className="min-w-0 flex-1 truncate font-medium">{d.title}</span>
                <span className="text-xs text-muted">{d.sourceType === "FILE" ? "file" : "text"} · {(d.charCount / 1000).toFixed(1)}k chars · {d.chunkCount} chunks</span>
                <StatusBadge status={d.status} />
                {d.error && <span className="w-full text-xs text-red-600">{d.error}</span>}
                <Button size="xs" variant="ghost" onClick={() => void api(`/api/ai/knowledge/${d.id}`, { method: "DELETE" }).then(() => list.refetch())} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Delete" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{list.loading ? "Loading…" : "No knowledge yet. Paste text or upload a TXT file."}</p>
        )}
      </Card>
      <Card>
        <CardHeader title="Add knowledge" />
        <div className="space-y-3">
          <Field label="Title"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Hoodie product sheet" /></Field>
          <Field label="Text"><Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[160px]" placeholder="Paste product details, MOQ, lead times, FAQs…" /></Field>
          <Button loading={saving} disabled={!title.trim() || !content.trim()} onClick={() => void addText()}>Add text</Button>
          <div className="border-t border-default pt-3">
            <label className={cn("flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-strong px-3 py-4 text-[13px] text-muted hover:bg-surface-2", uploading && "opacity-60")}>
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload TXT / Markdown / CSV"}
              <input type="file" accept=".txt,.md,.csv,.json" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} disabled={uploading} />
            </label>
          </div>
        </div>
      </Card>
    </div>
  );
}

function ActivityPanel() {
  const [page, setPage] = useState(1);
  const logs = useQuery<{ items: ActionLog[]; totalPages: number; total: number }>(`/api/ai/actions?page=${page}&pageSize=40`, { refreshInterval: 10_000 });
  return (
    <Card>
      <CardHeader title="AI activity log" description={`${logs.data?.total ?? 0} actions. Every generation, classification and autopilot decision is recorded with model, tokens and outcome.`} />
      <ul className="divide-y divide-[var(--border)]">
        {logs.data?.items.map((l) => (
          <li key={l.id} className="py-2.5 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{titleCase(l.action)}</Badge>
              <StatusBadge status={l.status} />
              <span className="text-muted">{l.triggeredBy === "AI" ? "autopilot" : l.triggeredBy.toLowerCase()}{l.client ? ` · ${l.client.brandName} (${l.client.cid})` : ""}</span>
              <span className="ml-auto text-xs text-faint">{formatDateTime(l.createdAt)}</span>
            </div>
            <p className="mt-0.5 text-xs text-faint">
              {l.model ?? "no model"}{l.tokensIn != null ? ` · ${l.tokensIn}→${l.tokensOut ?? 0} tokens` : ""}{l.durationMs != null ? ` · ${l.durationMs} ms` : ""}{l.confidence != null ? ` · ${Math.round(l.confidence * 100)}% confidence` : ""}
              {l.error ? <span className="text-red-600"> · {l.error}</span> : null}
            </p>
            {l.decision ? <pre className="mt-1 overflow-x-auto rounded bg-surface-2 p-2 text-[11px] text-muted">{JSON.stringify(l.decision)}</pre> : null}
          </li>
        ))}
        {!logs.loading && !logs.data?.items.length && <li className="py-6 text-center text-[13px] text-muted">No AI activity yet.</li>}
      </ul>
      {logs.data && logs.data.totalPages > 1 && (
        <div className="mt-3 flex justify-end gap-2">
          <Button size="xs" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
          <Button size="xs" variant="outline" disabled={page >= logs.data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      )}
    </Card>
  );
}
