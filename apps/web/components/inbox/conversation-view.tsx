"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Bot, Check, ExternalLink, FileText, Sparkles, User, X, Cpu, AlertTriangle, Clock } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, platformName, titleCase } from "@/lib/format";
import { Badge, Button, Select, StatusBadge, Textarea, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { MessageComposer, type ComposerAccount } from "@/components/messaging/composer";

interface Message {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  authorType: "USER" | "AI" | "SYSTEM" | "CLIENT";
  body: string;
  status: string;
  approvalStatus: string;
  providerKey: string | null;
  aiGenerated: boolean;
  aiModel: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  seenAt: string | null;
  failureReason: string | null;
  createdAt: string;
  meta: { statusTracking?: boolean; manual?: boolean; decision?: { providerKey?: string; reason?: string } } | null;
  attachments: Array<{ id: string; name: string; documentId: string | null }>;
  job: { id: string; status: string; provider: string; errorMessage: string | null; progressDetail: string | null } | null;
}

interface Detail {
  conversation: {
    id: string;
    channel: string;
    status: string;
    aiStatus: string;
    needsHumanReview: boolean;
    needsHumanReason: string | null;
    lastIntent: string | null;
    lastIntentConfidence: number | null;
    summary: string | null;
    summaryUpdatedAt: string | null;
    unreadCount: number;
    externalThreadId: string | null;
    client: { id: string; cid: string; brandName: string; status: string; timezone: string | null; doNotContact: boolean; socialAccounts: ComposerAccount[] };
    messages: Message[];
    scheduledMessages: Array<{ id: string; body: string; scheduledAt: string; timezone: string; status: string; createdByType: string }>;
    socialConnection: { id: string; platform: string; username: string | null; displayName: string | null; status: string } | null;
  };
}

function statusLabel(m: Message): string {
  if (m.direction === "INBOUND") return "";
  if (m.status === "SENT" && m.meta?.statusTracking === false) return "Sent · status unavailable";
  if (m.status === "SENT" && m.providerKey === "manual") return m.meta?.manual ? "Sent manually" : "Sent";
  if (m.status === "QUEUED" && m.job) return `Queued · ${m.job.provider.toLowerCase()}${m.job.progressDetail ? ` · ${m.job.progressDetail}` : ""}`;
  if (m.status === "SENDING" && m.job) return `Sending · ${titleCase(m.job.status)}`;
  if (m.status === "UNAVAILABLE") return "Not sent automatically";
  if (m.status === "FAILED") return `Failed${m.failureReason ? ` · ${m.failureReason}` : ""}`;
  if (m.status === "PENDING_APPROVAL") return "Awaiting your approval";
  return titleCase(m.status);
}

export function ConversationView({ conversationId, onChanged, onBack }: { conversationId: string; onChanged: () => void; onBack: () => void }) {
  const toast = useToast();
  const { data, loading, refetch } = useQuery<Detail>(`/api/conversations/${conversationId}`, { refreshInterval: 8000 });
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ draft: string; intent: { intent: string; confidence: number; summary: string } | null; validation: { ok: boolean; violations: Array<{ detail: string }> } } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logBody, setLogBody] = useState("");
  const [logDirection, setLogDirection] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const bottomRef = useRef<HTMLDivElement>(null);
  const conv = data?.conversation;
  const markedRead = useRef<string | null>(null);

  useEffect(() => {
    if (conv && conv.unreadCount > 0 && markedRead.current !== conv.id) {
      markedRead.current = conv.id;
      void api(`/api/conversations/${conv.id}`, { method: "PATCH", body: { markRead: true } }).then(onChanged);
    }
  }, [conv, onChanged]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conv?.messages.length]);

  const act = useCallback(async (name: string, fn: () => Promise<void>, success?: string) => {
    setBusy(name);
    try {
      await fn();
      if (success) toast.success(success);
      await refetch();
      onChanged();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }, [refetch, onChanged, toast]);

  if (loading && !conv) return <div className="p-6 text-[13px] text-muted">Loading conversation…</div>;
  if (!conv) return <div className="p-6 text-[13px] text-muted">Conversation not found.</div>;
  const pending = conv.messages.filter((m) => m.status === "PENDING_APPROVAL");
  const account = conv.client.socialAccounts.find((a) => a.platform === conv.channel);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-default bg-surface px-4 py-3">
        <button type="button" onClick={onBack} className="rounded-md p-1 text-muted hover:bg-surface-2 md:hidden" aria-label="Back"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/clients/${conv.client.cid}`} className="truncate text-[15px] font-semibold hover:underline">{conv.client.brandName}</Link>
            <span className="font-mono text-[11px] text-faint">{conv.client.cid}</span>
            <StatusBadge status={conv.client.status} />
            <Badge tone="brand">{platformName(conv.channel)}{account?.username ? ` @${account.username}` : ""}</Badge>
            {conv.socialConnection && <Badge tone="success">via {conv.socialConnection.displayName ?? "official API"}</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {conv.lastIntent ? `Intent: ${titleCase(conv.lastIntent)}${conv.lastIntentConfidence != null ? ` (${Math.round(conv.lastIntentConfidence * 100)}%)` : ""}` : "No intent detected yet"}
            {conv.needsHumanReview && <span className="ml-2 text-amber-600"><AlertTriangle className="mr-1 inline h-3 w-3" />{conv.needsHumanReason ?? "Needs human review"}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {account?.inboxUrl && (
            <Button size="sm" variant="outline" href={account.inboxUrl} icon={<ExternalLink className="h-3.5 w-3.5" />}>
              Open in {platformName(conv.channel)}
            </Button>
          )}
          <Button size="sm" variant="outline" loading={busy === "summary"} onClick={() => act("summary", async () => { await api(`/api/conversations/${conv.id}/summarize`, { method: "POST" }); }, "Summary updated")} icon={<FileText className="h-3.5 w-3.5" />}>Summarize</Button>
          {conv.needsHumanReview && <Button size="sm" variant="outline" onClick={() => act("review", async () => { await api(`/api/conversations/${conv.id}`, { method: "PATCH", body: { needsHumanReview: false } }); }, "Marked as handled")} icon={<Check className="h-3.5 w-3.5" />}>Handled</Button>}
          <Select value={conv.status} onChange={(e) => act("status", async () => { await api(`/api/conversations/${conv.id}`, { method: "PATCH", body: { status: e.target.value } }); })} className="h-8 w-28 text-xs">
            <option value="OPEN">Open</option>
            <option value="CLOSED">Closed</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </header>

      {conv.summary && (
        <div className="border-b border-default bg-surface-2/60 px-4 py-2 text-[12px] text-muted">
          <span className="font-medium text-body">AI summary:</span> {conv.summary} <span className="text-faint">({conv.summaryUpdatedAt ? formatDateTime(conv.summaryUpdatedAt) : ""})</span>
        </div>
      )}

      <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {conv.messages.length === 0 && <p className="py-10 text-center text-[13px] text-muted">No messages yet.</p>}
        {conv.messages.map((m) => {
          const mine = m.direction === "OUTBOUND";
          const isPending = m.status === "PENDING_APPROVAL";
          const cancelled = m.status === "CANCELLED";
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-sm", mine ? (isPending ? "border border-dashed border-brand-300 bg-brand-50/60 text-body dark:bg-brand-900/20" : cancelled ? "bg-surface-2 text-faint line-through" : "bg-brand-500 text-white") : "border border-default bg-surface text-body")}>
                <div className={cn("mb-1 flex items-center gap-1.5 text-[11px]", mine && !isPending && !cancelled ? "text-white/80" : "text-faint")}>
                  {m.authorType === "AI" ? <Bot className="h-3 w-3" /> : m.authorType === "CLIENT" ? <User className="h-3 w-3" /> : m.authorType === "SYSTEM" ? <Cpu className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  <span>{m.authorType === "AI" ? `AI${m.aiModel ? ` · ${m.aiModel}` : ""}` : m.authorType === "CLIENT" ? "Client" : m.authorType === "SYSTEM" ? "System" : "You"}</span>
                  <span>· {formatDateTime(m.sentAt ?? m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {m.attachments.length > 0 && <p className="mt-1 text-[11px] opacity-80">Attachments: {m.attachments.map((a) => a.name).join(", ")}</p>}
                {mine && (
                  <p className={cn("mt-1 text-[11px]", isPending || cancelled ? "text-faint" : m.status === "UNAVAILABLE" || m.status === "FAILED" ? "text-amber-100" : "text-white/75")}>
                    {statusLabel(m)}
                    {m.seenAt ? ` · seen ${formatDateTime(m.seenAt)}` : m.deliveredAt ? ` · delivered` : ""}
                  </p>
                )}
                {isPending && (
                  <div className="mt-2 flex gap-1.5">
                    <Button size="xs" loading={busy === `approve-${m.id}`} onClick={() => act(`approve-${m.id}`, async () => { await api(`/api/messages/${m.id}/approve`, { body: { delivery: "automation" } }); }, "Approved and queued")} icon={<Check className="h-3 w-3" />}>Approve & send</Button>
                    <Button size="xs" variant="outline" loading={busy === `manual-${m.id}`} onClick={() => act(`manual-${m.id}`, async () => { const r = await api<{ openUrl: string | null }>(`/api/messages/${m.id}/approve`, { body: { delivery: "manual" } }); if (r.openUrl) window.open(r.openUrl, "_blank", "noopener"); }, "Recorded as sent")}>Send myself</Button>
                    <Button size="xs" variant="ghost" loading={busy === `reject-${m.id}`} onClick={() => act(`reject-${m.id}`, async () => { await api(`/api/messages/${m.id}/reject`, { method: "POST" }); }, "Suggestion rejected")} icon={<X className="h-3 w-3" />}>Reject</Button>
                  </div>
                )}
                {m.status === "UNAVAILABLE" && account?.inboxUrl && (
                  <a href={account.inboxUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] underline">Send it manually <ExternalLink className="h-3 w-3" /></a>
                )}
              </div>
            </div>
          );
        })}
        {conv.scheduledMessages.map((s) => (
          <div key={s.id} className="flex justify-end">
            <div className="max-w-[78%] rounded-2xl border border-dashed border-default bg-surface-2/60 px-3.5 py-2.5 text-[13px] text-muted">
              <p className="mb-1 flex items-center gap-1.5 text-[11px] text-faint"><Clock className="h-3 w-3" /> Scheduled for {formatDateTime(s.scheduledAt)} ({s.timezone}) · {s.createdByType === "AI" ? "AI" : "you"} <StatusBadge status={s.status} /></p>
              <p className="whitespace-pre-wrap">{s.body}</p>
              <button type="button" className="mt-1 text-[11px] text-red-600 hover:underline" onClick={() => act(`cancel-${s.id}`, async () => { await api(`/api/messages/scheduled/${s.id}`, { method: "DELETE" }); }, "Cancelled")}>Cancel</button>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="border-t border-default bg-surface p-3">
        {conv.client.doNotContact ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">This client is marked do-not-contact. Messaging is disabled.</p>
        ) : (
          <>
            {pending.length === 0 && (
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" loading={busy === "suggest"} onClick={() => act("suggest", async () => { const s = await api<typeof suggestion>(`/api/conversations/${conv.id}/suggest`, { body: {} }); setSuggestion(s); })} icon={<Sparkles className="h-3.5 w-3.5 text-brand-500" />}>
                  {conv.messages.some((m) => m.direction === "INBOUND") ? "Suggest reply" : "Suggest follow-up"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLogOpen((o) => !o)}>Log a message exchanged elsewhere</Button>
              </div>
            )}
            {logOpen && (
              <div className="mb-3 space-y-2 rounded-lg border border-default bg-surface-2/60 p-3">
                <div className="flex gap-2">
                  <Select value={logDirection} onChange={(e) => setLogDirection(e.target.value as "INBOUND" | "OUTBOUND")} className="w-44">
                    <option value="INBOUND">Client wrote to us</option>
                    <option value="OUTBOUND">We wrote to client</option>
                  </Select>
                  <span className="text-xs text-faint self-center">Use this when the conversation happened directly in {platformName(conv.channel)}.</span>
                </div>
                <Textarea value={logBody} onChange={(e) => setLogBody(e.target.value)} className="min-h-[70px]" placeholder="Paste the message text" />
                <div className="flex gap-2">
                  <Button size="sm" loading={busy === "log"} onClick={() => act("log", async () => { await api("/api/messages/log", { body: { conversationId: conv.id, direction: logDirection, body: logBody } }); setLogBody(""); setLogOpen(false); }, "Message logged")}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
                </div>
              </div>
            )}
            {suggestion && (
              <div className="mb-2 rounded-lg border border-brand-100 bg-brand-50/60 p-2 text-[12px] dark:border-brand-800 dark:bg-brand-900/20">
                {suggestion.intent && <p className="text-muted">Detected intent: <span className="font-medium text-body">{titleCase(suggestion.intent.intent)}</span> ({Math.round(suggestion.intent.confidence * 100)}%) — {suggestion.intent.summary}</p>}
                {!suggestion.validation.ok && <p className="text-red-600">Rule check: {suggestion.validation.violations.map((v) => v.detail).join("; ")}</p>}
              </div>
            )}
            <MessageComposer key={suggestion?.draft ?? "composer"} clientId={conv.client.id} accounts={conv.client.socialAccounts.filter((a) => a.platform === conv.channel)} conversationId={conv.id} kind={conv.messages.some((m) => m.direction === "INBOUND") ? "reply" : "follow_up"} initialText={suggestion?.draft ?? ""} clientTimezone={conv.client.timezone} compact onSent={() => { setSuggestion(null); void refetch(); onChanged(); }} />
          </>
        )}
      </footer>
    </div>
  );
}
