"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bot, CalendarClock, ExternalLink, Send, Sparkles, Wand2 } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { Badge, Button, Select, Textarea, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

export interface ComposerAccount {
  id: string;
  platform: string;
  username: string | null;
  profileUrl: string;
  inboxUrl: string | null;
  messagingEligibility: string;
  eligibilityReason: string | null;
}

interface Draft {
  draft: string;
  validation: { ok: boolean; violations: Array<{ rule: string; detail: string; severity: string }> };
  personalizationUsed: string[];
  factsUsed: string[];
  openQuestions: string[];
  confidence: number;
  actionLogId: string;
  model: string;
  channel: string;
}

export interface SendOutcome {
  message: { id: string; status: string; failureReason: string | null };
  decision: { providerKey: string; reason: string | null; considered: Array<{ providerKey: string; capability: { canSend: boolean; reason: string | null } }> } | null;
  send: { status: string; providerKey: string; statusTracking: boolean; error?: string | null } | null;
  openUrl: string | null;
  conversationId: string;
}

const VARIANTS: Array<{ key: "regenerate" | "shorter" | "more_professional" | "more_friendly" | "personalize"; label: string }> = [
  { key: "regenerate", label: "Regenerate" },
  { key: "shorter", label: "Shorter" },
  { key: "more_professional", label: "More professional" },
  { key: "more_friendly", label: "More friendly" },
  { key: "personalize", label: "Personalize" },
];

export function MessageComposer({ clientId, accounts, conversationId, kind = "first_contact", initialText = "", onSent, compact, clientTimezone, autoGenerate }: { clientId: string; accounts: ComposerAccount[]; conversationId?: string; kind?: "first_contact" | "reply" | "follow_up"; initialText?: string; onSent?: (outcome: SendOutcome) => void; compact?: boolean; clientTimezone?: string | null; autoGenerate?: boolean }) {
  const toast = useToast();
  const [channel, setChannel] = useState<string>(accounts[0]?.platform ?? "INSTAGRAM");
  const [text, setText] = useState(initialText);
  const [ai, setAi] = useState<Draft | null>(null);
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [sending, setSending] = useState<"automation" | "manual" | "schedule" | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [tzMode, setTzMode] = useState<"client" | "exporter" | "custom">("client");
  const [customTz, setCustomTz] = useState("");
  const [outcome, setOutcome] = useState<SendOutcome | null>(null);
  const account = accounts.find((a) => a.platform === channel) ?? accounts[0];

  useEffect(() => {
    if (autoGenerate && !text && !ai && !generating) void generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate]);

  async function generate(variant?: (typeof VARIANTS)[number]["key"]) {
    setGenerating(variant ?? "generate");
    try {
      const res = await api<Draft>("/api/messages/generate", { body: { clientId, conversationId, channel, kind, variant, previousDraft: variant ? text : undefined, instruction: instruction || undefined } });
      setAi(res);
      setText(res.draft);
      if (!res.validation.ok) toast.warning("Draft needs review", res.validation.violations.map((v) => v.detail).join(" · "));
    } catch (err) {
      toast.error("AI generation failed", err instanceof Error ? err.message : undefined);
    } finally {
      setGenerating(null);
    }
  }

  async function send(delivery: "automation" | "manual") {
    if (!text.trim()) return toast.warning("Write or generate a message first");
    setSending(delivery);
    try {
      const res = await api<SendOutcome>("/api/messages/send", { body: { clientId, conversationId, channel, body: text, delivery, aiActionLogId: ai && ai.draft === text ? ai.actionLogId : undefined } });
      setOutcome(res);
      if (delivery === "manual" && res.openUrl) window.open(res.openUrl, "_blank", "noopener");
      if (res.message.status === "SENT") toast.success(delivery === "manual" ? "Recorded as sent" : "Message sent");
      else if (res.message.status === "QUEUED") toast.success("Queued for delivery", `Provider: ${res.send?.providerKey}`);
      else toast.warning("Cannot be sent automatically", res.message.failureReason ?? undefined);
      onSent?.(res);
      if (res.message.status !== "UNAVAILABLE") {
        setText("");
        setAi(null);
      }
    } catch (err) {
      toast.error("Send failed", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(null);
    }
  }

  async function schedule() {
    if (!text.trim() || !scheduleAt) return toast.warning("Choose a date and time");
    setSending("schedule");
    try {
      await api("/api/messages/schedule", { body: { clientId, conversationId, channel, body: text, scheduledAt: scheduleAt, timezone: tzMode === "custom" ? customTz || undefined : undefined, timezoneMode: tzMode, aiActionLogId: ai && ai.draft === text ? ai.actionLogId : undefined } });
      toast.success("Message scheduled");
      setScheduleOpen(false);
      setText("");
      setAi(null);
      onSent?.({ message: { id: "", status: "SCHEDULED", failureReason: null }, decision: null, send: null, openUrl: null, conversationId: conversationId ?? "" });
    } catch (err) {
      toast.error("Could not schedule", err instanceof Error ? err.message : undefined);
    } finally {
      setSending(null);
    }
  }

  const isAiText = ai !== null && ai.draft === text;
  const blocked = isAiText && ai && !ai.validation.ok;

  return (
    <div className={cn("space-y-3", compact && "space-y-2")}>
      <div className="flex flex-wrap items-center gap-2">
        {accounts.length > 1 ? (
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-40">
            {accounts.map((a) => (
              <option key={a.id} value={a.platform}>
                {a.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}{a.username ? ` @${a.username}` : ""}
              </option>
            ))}
          </Select>
        ) : account ? (
          <Badge tone="brand">{account.platform === "INSTAGRAM" ? "Instagram" : "Facebook"}{account.username ? ` @${account.username}` : ""}</Badge>
        ) : (
          <Badge tone="warning">No social account on this client</Badge>
        )}
        {account && <Badge tone={account.messagingEligibility === "MESSAGEABLE" ? "success" : account.messagingEligibility === "NOT_MESSAGEABLE" ? "danger" : "neutral"} className="font-normal" >{account.messagingEligibility.replace(/_/g, " ").toLowerCase()}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button size="sm" variant={text ? "outline" : "primary"} loading={generating === "generate"} onClick={() => void generate()} icon={<Sparkles className="h-3.5 w-3.5" />}>
            {text ? "Generate again" : "Generate with AI"}
          </Button>
        </div>
      </div>
      {!compact && (
        <input value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Optional instruction for the AI, e.g. “mention our hoodie range and ask about their next drop”" className="h-9 w-full rounded-lg border border-strong bg-surface px-3 text-[13px] placeholder:text-faint" />
      )}
      <div className="relative">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "first_contact" ? "Write the first message, or generate one with AI…" : "Write your reply…"} className={cn("min-h-[140px] pr-3 text-[14px] leading-relaxed", isAiText && "border-brand-300 bg-brand-50/30 dark:bg-brand-900/10")} />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] tabular text-faint">{text.length} chars</span>
      </div>
      {isAiText && ai && (
        <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/60 p-3 text-[12px] dark:border-brand-800 dark:bg-brand-900/20">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand"><Bot className="mr-1 h-3 w-3" /> AI generated</Badge>
            <span className="text-muted">{ai.model} · confidence {Math.round(ai.confidence * 100)}%</span>
            {ai.personalizationUsed.length > 0 && <span className="text-muted">· personalized with: {ai.personalizationUsed.join(", ")}</span>}
          </div>
          {ai.factsUsed.length > 0 && <p className="text-muted">Company facts used: {ai.factsUsed.join("; ")}</p>}
          {ai.openQuestions.length > 0 && <p className="text-amber-700 dark:text-amber-300">Could not answer from company facts: {ai.openQuestions.join("; ")}</p>}
          {ai.validation.violations.length > 0 && (
            <ul className="space-y-0.5">
              {ai.validation.violations.map((v, i) => (
                <li key={i} className={cn("flex items-start gap-1.5", v.severity === "block" ? "text-red-600" : "text-amber-700 dark:text-amber-300")}>
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {v.detail}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-1 pt-1">
            {VARIANTS.map((v) => (
              <Button key={v.key} size="xs" variant="ghost" loading={generating === v.key} onClick={() => void generate(v.key)} icon={<Wand2 className="h-3 w-3" />}>
                {v.label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {blocked && <p className="text-[12px] text-red-600">This draft violates business rules. Edit it before sending, or regenerate.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => void send("automation")} loading={sending === "automation"} disabled={Boolean(blocked) || !account} icon={<Send className="h-4 w-4" />}>
          Send now
        </Button>
        <Button variant="outline" onClick={() => void send("manual")} loading={sending === "manual"} disabled={!account} icon={<ExternalLink className="h-4 w-4" />} title="Opens the platform in a new tab and records the message as sent by you">
          I&apos;ll send it myself
        </Button>
        <Button variant="outline" onClick={() => setScheduleOpen((o) => !o)} icon={<CalendarClock className="h-4 w-4" />}>
          Schedule
        </Button>
      </div>
      {scheduleOpen && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-default bg-surface-2/60 p-3">
          <label className="text-[12px]">
            <span className="mb-1 block font-medium">Date & time</span>
            <input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-9 rounded-lg border border-strong bg-surface px-2 text-[13px]" />
          </label>
          <label className="text-[12px]">
            <span className="mb-1 block font-medium">Timezone</span>
            <Select value={tzMode} onChange={(e) => setTzMode(e.target.value as typeof tzMode)} className="w-44">
              <option value="client">Client&apos;s time{clientTimezone ? ` (${clientTimezone})` : ""}</option>
              <option value="exporter">My company time</option>
              <option value="custom">Custom</option>
            </Select>
          </label>
          {tzMode === "custom" && <input value={customTz} onChange={(e) => setCustomTz(e.target.value)} placeholder="America/New_York" className="h-9 w-44 rounded-lg border border-strong bg-surface px-2 text-[13px]" />}
          <Button size="sm" onClick={() => void schedule()} loading={sending === "schedule"}>
            Confirm schedule
          </Button>
        </div>
      )}
      {outcome && (
        <div className={cn("rounded-lg border p-3 text-[12px]", outcome.message.status === "UNAVAILABLE" || outcome.message.status === "FAILED" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200")}>
          <p className="font-medium">
            {outcome.message.status === "SENT" ? "Message recorded as sent" : outcome.message.status === "QUEUED" ? `Queued for ${outcome.send?.providerKey === "extension" ? "the browser extension" : outcome.send?.providerKey === "apify" ? "cloud automation" : "the official API"}` : "Message cannot be sent automatically"}
          </p>
          {outcome.decision?.reason && <p className="mt-0.5 opacity-80">{outcome.decision.reason}</p>}
          {outcome.decision?.considered?.length ? <p className="mt-1 opacity-70">Providers checked: {outcome.decision.considered.map((c) => `${c.providerKey} (${c.capability.canSend ? "ok" : c.capability.reason})`).join("; ")}</p> : null}
          {outcome.message.status === "UNAVAILABLE" && outcome.openUrl && (
            <a href={outcome.openUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-medium underline">
              Open in {channel === "INSTAGRAM" ? "Instagram" : "Facebook"} and send manually <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
