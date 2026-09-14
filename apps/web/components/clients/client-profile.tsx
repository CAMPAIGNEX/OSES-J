"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bot, ExternalLink, Globe, Mail, MessageSquare, Phone, RefreshCw, Sparkles, Trash2, Pencil, ShieldOff } from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatCompact, formatDateTime, platformName, timeAgo, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, Field, Input, Select, Skeleton, StatusBadge, Switch, Textarea, cn } from "@/components/ui/primitives";
import { KeyValue } from "@/components/ui/data";
import { ConfirmDialog, Dialog, Tabs, useToast } from "@/components/ui/overlay";
import { MessageComposer, type ComposerAccount } from "@/components/messaging/composer";

interface ClientDetail {
  client: {
    id: string;
    cid: string;
    brandName: string;
    companyName: string | null;
    category: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    address: string | null;
    timezone: string | null;
    timezoneSource: string | null;
    followers: number | null;
    bio: string | null;
    source: string | null;
    leadScore: number;
    status: string;
    doNotContact: boolean;
    doNotContactReason: string | null;
    aiSummary: string | null;
    aiAnalysis: { fitScore?: number; likelyProducts?: string[]; talkingPoints?: string[]; risks?: string[]; suggestedChannel?: string; summary?: string } | null;
    lastContactedAt: string | null;
    lastReplyAt: string | null;
    createdAt: string;
    socialAccounts: Array<ComposerAccount & { externalId: string | null; followers: number | null; bio: string | null; isBusiness: boolean | null; scopedUserId: string | null; externalThreadId: string | null; eligibilityCheckedAt: string | null }>;
    contacts: Array<{ id: string; type: string; value: string; source: string; sourceUrl: string | null; confidence: string; label: string | null }>;
    tags: Array<{ tag: { id: string; name: string } }>;
    notes: Array<{ id: string; body: string; createdAt: string }>;
    conversations: Array<{ id: string; channel: string; status: string; lastMessageAt: string | null; lastMessagePreview: string | null; unreadCount: number; messageCount: number; aiStatus: string; needsHumanReview: boolean; lastIntent: string | null }>;
    scheduledMessages: Array<{ id: string; channel: string; body: string; scheduledAt: string; timezone: string; status: string; createdByType: string }>;
    documents: Array<{ id: string; name: string; kind: string; sizeBytes: number; createdAt: string }>;
    activities: Array<{ id: string; type: string; title: string; description: string | null; actorType: string; createdAt: string }>;
    aiActionLogs: Array<{ id: string; action: string; status: string; triggeredBy: string; model: string | null; confidence: number | null; createdAt: string; decision: unknown }>;
    lead: { id: string; enrichmentStatus: string } | null;
  };
}

type Tab = "overview" | "conversations" | "scheduled" | "documents" | "activity" | "ai";

export function ClientProfile({ cid }: { cid: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery<ClientDetail>(`/api/clients/${cid}`);
  const [tab, setTab] = useState<Tab>("overview");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const c = data?.client;

  async function act(name: string, fn: () => Promise<void>, success?: string) {
    setBusy(name);
    try {
      await fn();
      if (success) toast.success(success);
      await refetch();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  if (loading && !c) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-64 lg:col-span-2" /><Skeleton className="h-64" /></div>
      </div>
    );
  }
  if (!c) return <p className="text-muted">Client not found.</p>;
  const primary = c.socialAccounts[0];
  const openConversation = c.conversations[0];

  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={<Link href="/clients" className="hover:underline">Clients</Link>}
        title={
          <span className="flex flex-wrap items-center gap-2">
            {c.brandName}
            <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12px] font-semibold text-brand-600">{c.cid}</span>
            <StatusBadge status={c.status} />
            {c.doNotContact && <Badge tone="danger"><ShieldOff className="mr-1 h-3 w-3" />Do not contact</Badge>}
          </span>
        }
        description={[c.companyName, c.category, [c.city, c.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)} icon={<Pencil className="h-4 w-4" />}>Edit</Button>
            {openConversation && (
              <Button variant="outline" href={`/inbox/${openConversation.id}`} icon={<MessageSquare className="h-4 w-4" />}>Conversation</Button>
            )}
            <Button onClick={() => setComposerOpen(true)} disabled={c.doNotContact || !c.socialAccounts.length} icon={<Sparkles className="h-4 w-4" />}>AI Contact</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />} aria-label="Delete client" />
          </>
        }
      />

      <Tabs value={tab} onChange={setTab} className="mb-4" items={[{ value: "overview", label: "Overview" }, { value: "conversations", label: "Conversations", count: c.conversations.length }, { value: "scheduled", label: "Scheduled", count: c.scheduledMessages.length }, { value: "documents", label: "Documents", count: c.documents.length }, { value: "activity", label: "Activity" }, { value: "ai", label: "AI actions", count: c.aiActionLogs.length }]} />

      {tab === "overview" && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card>
              <CardHeader title="Client profile" actions={c.website ? <Button size="sm" variant="outline" loading={busy === "enrich"} onClick={() => act("enrich", async () => { await api(`/api/clients/${c.cid}/enrich`, { method: "POST" }); }, "Website checked for contact details")} icon={<RefreshCw className="h-3.5 w-3.5" />}>Enrich from website</Button> : undefined} />
              <KeyValue
                columns={2}
                items={[
                  { label: "Brand", value: c.brandName },
                  { label: "Company", value: c.companyName },
                  { label: "Category", value: c.category },
                  { label: "Website", value: c.website ? <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Globe className="h-3 w-3" />{c.website}</a> : null },
                  { label: "Email", value: c.email ? <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="h-3 w-3 text-faint" />{c.email}</a> : null },
                  { label: "Phone", value: c.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-faint" />{c.phone}</span> : null },
                  { label: "WhatsApp", value: c.whatsapp ? <a href={`https://wa.me/${c.whatsapp.replace("+", "")}`} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">{c.whatsapp}</a> : null },
                  { label: "Location", value: [c.address, c.city, c.region, c.country].filter(Boolean).join(", ") || null },
                  { label: "Timezone", value: c.timezone ? `${c.timezone}${c.timezoneSource ? ` (${c.timezoneSource})` : ""}` : null },
                  { label: "Followers", value: formatCompact(c.followers) },
                  { label: "Lead score", value: `${c.leadScore}/100` },
                  { label: "Source", value: c.source },
                  { label: "Last contacted", value: c.lastContactedAt ? `${formatDateTime(c.lastContactedAt)} (${timeAgo(c.lastContactedAt)})` : null },
                  { label: "Last reply", value: c.lastReplyAt ? `${formatDateTime(c.lastReplyAt)} (${timeAgo(c.lastReplyAt)})` : null },
                ]}
              />
              {c.bio && <p className="mt-4 whitespace-pre-wrap border-t border-default pt-4 text-[13px]">{c.bio}</p>}
              {c.tags.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t.tag.id}>{t.tag.name}</Badge>)}</div>}
            </Card>

            <Card>
              <CardHeader title="Connected channels" description="Messaging eligibility is checked against your configured providers; a profile URL alone never implies permission to message." actions={<Button size="sm" variant="outline" loading={busy === "elig"} onClick={() => act("elig", async () => { await api(`/api/clients/${c.cid}/eligibility`, { method: "POST" }); }, "Eligibility re-checked")}>Re-check</Button>} />
              {c.socialAccounts.length ? (
                <ul className="space-y-2">
                  {c.socialAccounts.map((a) => (
                    <li key={a.id} className="rounded-lg border border-default p-3 text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="brand">{platformName(a.platform)}</Badge>
                        <a href={a.profileUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">{a.username ? `@${a.username}` : a.profileUrl}<ExternalLink className="ml-1 inline h-3 w-3" /></a>
                        <StatusBadge status={a.messagingEligibility} />
                        {a.followers != null && <span className="text-xs text-muted">{formatCompact(a.followers)} followers</span>}
                        {a.inboxUrl && <a href={a.inboxUrl} target="_blank" rel="noreferrer" className="ml-auto text-xs text-brand-600 hover:underline">Open inbox</a>}
                      </div>
                      <p className="mt-1 text-xs text-muted">{a.eligibilityReason ?? "Not checked yet"}{a.eligibilityCheckedAt ? ` · checked ${timeAgo(a.eligibilityCheckedAt)}` : ""}</p>
                      <p className="mt-0.5 text-[11px] text-faint">
                        {a.externalId ? `id ${a.externalId}` : "no external id"}{a.externalThreadId ? ` · thread ${a.externalThreadId}` : ""}{a.scopedUserId ? " · official API thread available" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No social accounts. Edit the client to add an Instagram username or Facebook page.</p>
              )}
            </Card>

            <Card>
              <CardHeader title="Contact sources" />
              {c.contacts.length ? (
                <ul className="divide-y divide-[var(--border)]">
                  {c.contacts.map((ct) => (
                    <li key={ct.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                      <Badge>{titleCase(ct.type)}</Badge>
                      <span className="min-w-0 flex-1 break-all font-medium">{ct.value}</span>
                      <span className="text-xs text-muted">Source: {titleCase(ct.source)}{ct.label ? ` (${ct.label})` : ""}</span>
                      <StatusBadge status={ct.confidence} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] text-muted">No contact details recorded.</p>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-brand-100 dark:border-brand-800">
              <CardHeader title={<span className="flex items-center gap-2"><Bot className="h-4 w-4 text-brand-500" /> AI analysis</span>} actions={<Button size="sm" variant="outline" loading={busy === "analyze"} onClick={() => act("analyze", async () => { await api(`/api/clients/${c.cid}/analyze`, { method: "POST" }); }, "Analysis updated")}>{c.aiAnalysis ? "Refresh" : "Analyze"}</Button>} />
              {c.aiAnalysis ? (
                <div className="space-y-3 text-[13px]">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-semibold tabular">{c.aiAnalysis.fitScore ?? "—"}<span className="text-sm text-faint">/100 fit</span></div>
                    {c.aiAnalysis.suggestedChannel && <Badge tone="brand">{titleCase(c.aiAnalysis.suggestedChannel)}</Badge>}
                  </div>
                  <p className="text-muted">{c.aiAnalysis.summary ?? c.aiSummary}</p>
                  {c.aiAnalysis.likelyProducts?.length ? <p><span className="font-medium">Likely products:</span> {c.aiAnalysis.likelyProducts.join(", ")}</p> : null}
                  {c.aiAnalysis.talkingPoints?.length ? <div><p className="font-medium">Talking points</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{c.aiAnalysis.talkingPoints.map((t, i) => <li key={i}>{t}</li>)}</ul></div> : null}
                  {c.aiAnalysis.risks?.length ? <div><p className="font-medium">Risks</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">{c.aiAnalysis.risks.map((t, i) => <li key={i}>{t}</li>)}</ul></div> : null}
                  <p className="text-[11px] text-faint">AI interpretation based on public profile data — verify before relying on it.</p>
                </div>
              ) : (
                <p className="text-[13px] text-muted">Let the AI assess fit, likely products and talking points before you reach out.</p>
              )}
            </Card>
            <Card>
              <CardHeader title="Notes" />
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note…" className="min-h-[70px]" />
              <Button className="mt-2" size="sm" variant="outline" disabled={!note.trim()} loading={busy === "note"} onClick={() => act("note", async () => { await api(`/api/clients/${c.cid}/notes`, { body: { body: note } }); setNote(""); }, "Note added")}>Add note</Button>
              <ul className="mt-3 space-y-2">
                {c.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-surface-2 p-2.5 text-[13px]">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-[11px] text-faint">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "conversations" && (
        <Card>
          {c.conversations.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {c.conversations.map((cv) => (
                <li key={cv.id}>
                  <Link href={`/inbox/${cv.id}`} className="flex items-center gap-3 py-3 hover:bg-surface-2/60 -mx-2 px-2 rounded-lg">
                    <Badge tone="brand">{platformName(cv.channel)}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">{cv.lastMessagePreview ?? "No messages yet"}</p>
                      <p className="text-xs text-faint">{cv.messageCount} messages · {cv.lastMessageAt ? timeAgo(cv.lastMessageAt) : "—"}{cv.lastIntent ? ` · intent ${titleCase(cv.lastIntent)}` : ""}</p>
                    </div>
                    {cv.unreadCount > 0 && <Badge tone="brand">{cv.unreadCount} new</Badge>}
                    {cv.needsHumanReview && <Badge tone="warning">Needs review</Badge>}
                    <StatusBadge status={cv.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted">No conversations yet. Use AI Contact to send the first message.</p>
          )}
        </Card>
      )}

      {tab === "scheduled" && (
        <Card>
          {c.scheduledMessages.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {c.scheduledMessages.map((s) => (
                <li key={s.id} className="flex items-start gap-3 py-3 text-[13px]">
                  <Badge tone="brand">{platformName(s.channel)}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap">{s.body}</p>
                    <p className="mt-1 text-xs text-faint">{formatDateTime(s.scheduledAt)} · {s.timezone} · by {s.createdByType === "AI" ? "AI" : "you"}</p>
                  </div>
                  <StatusBadge status={s.status} />
                  <Button size="xs" variant="ghost" onClick={() => act("cancel", async () => { await api(`/api/messages/scheduled/${s.id}`, { method: "DELETE" }); }, "Scheduled message cancelled")}>Cancel</Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted">Nothing scheduled.</p>
          )}
        </Card>
      )}

      {tab === "documents" && (
        <Card>
          <CardHeader title="Documents" actions={<Button size="sm" variant="outline" href={`/documents?clientId=${c.id}`}>Manage in Documents</Button>} />
          {c.documents.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2 text-[13px]">
                  <span className="flex-1 font-medium">{d.name}</span>
                  <Badge>{titleCase(d.kind)}</Badge>
                  <span className="text-xs text-faint">{(d.sizeBytes / 1024).toFixed(0)} KB</span>
                  <a href={`/api/documents/${d.id}/download`} className="text-brand-600 hover:underline">Download</a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted">No documents attached to this client.</p>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {c.activities.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5 text-[13px]">
                <span className={cn("mt-0.5 h-2 w-2 shrink-0 rounded-full", a.actorType === "AI" ? "bg-brand-500" : a.actorType === "SYSTEM" ? "bg-slate-400" : "bg-emerald-500")} />
                <div className="min-w-0 flex-1">
                  <p>{a.title}</p>
                  {a.description && <p className="truncate text-xs text-muted">{a.description}</p>}
                </div>
                <span className="text-xs text-faint">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
            {!c.activities.length && <li className="py-6 text-center text-[13px] text-muted">No activity yet.</li>}
          </ul>
        </Card>
      )}

      {tab === "ai" && (
        <Card>
          <ul className="divide-y divide-[var(--border)]">
            {c.aiActionLogs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[13px]">
                <Badge tone="brand">{titleCase(l.action)}</Badge>
                <StatusBadge status={l.status} />
                <span className="text-xs text-muted">by {l.triggeredBy.toLowerCase()}{l.model ? ` · ${l.model}` : ""}{l.confidence != null ? ` · ${Math.round(l.confidence * 100)}%` : ""}</span>
                <span className="ml-auto text-xs text-faint">{formatDateTime(l.createdAt)}</span>
                {l.decision ? <pre className="w-full overflow-x-auto rounded bg-surface-2 p-2 text-[11px] text-muted">{JSON.stringify(l.decision)}</pre> : null}
              </li>
            ))}
            {!c.aiActionLogs.length && <li className="py-6 text-center text-[13px] text-muted">No AI actions for this client yet.</li>}
          </ul>
        </Card>
      )}

      <Dialog open={composerOpen} onClose={() => setComposerOpen(false)} title={`AI Contact · ${c.brandName}`} description="The AI drafts a personalized first message from public profile data and your company facts. Review, edit, then send or schedule." size="lg">
        <MessageComposer clientId={c.id} accounts={c.socialAccounts} kind="first_contact" clientTimezone={c.timezone} autoGenerate onSent={(o) => { void refetch(); if (o.conversationId) router.push(`/inbox/${o.conversationId}`); }} />
      </Dialog>
      <EditClientDialog open={editOpen} onClose={() => setEditOpen(false)} client={c} onSaved={() => { setEditOpen(false); void refetch(); }} />
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={async () => { await api(`/api/clients/${c.cid}`, { method: "DELETE" }); toast.info("Client moved to trash"); router.push("/clients"); }} title={`Delete ${c.brandName}?`} description="The client moves to the Trash for 7 days. Scheduled messages and campaign steps are cancelled." confirmLabel="Move to trash" tone="danger" />
    </div>
  );
}

function EditClientDialog({ open, onClose, client, onSaved }: { open: boolean; onClose: () => void; client: ClientDetail["client"]; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ brandName: client.brandName, companyName: client.companyName ?? "", category: client.category ?? "", website: client.website ?? "", email: client.email ?? "", phone: client.phone ?? "", whatsapp: client.whatsapp ?? "", country: client.country ?? "", region: client.region ?? "", city: client.city ?? "", address: client.address ?? "", timezone: client.timezone ?? "", status: client.status, doNotContact: client.doNotContact, instagramUsername: "", facebookUrl: "", tags: client.tags.map((t) => t.tag.name).join(", ") });
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function save() {
    setLoading(true);
    try {
      const { tags, instagramUsername, facebookUrl, ...rest } = form;
      await api(`/api/clients/${client.cid}`, { method: "PATCH", body: { ...rest, timezone: rest.timezone || null, instagramUsername: instagramUsername || undefined, facebookUrl: facebookUrl || undefined } });
      await api(`/api/clients/${client.cid}/tags`, { method: "PUT", body: { tags: tags.split(",").map((t) => t.trim()).filter(Boolean) } });
      toast.success("Client updated");
      onSaved();
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Edit client" size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => void save()} loading={loading}>Save changes</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand name" className="sm:col-span-2"><Input value={form.brandName} onChange={set("brandName")} /></Field>
        <Field label="Company"><Input value={form.companyName} onChange={set("companyName")} /></Field>
        <Field label="Category"><Input value={form.category} onChange={set("category")} /></Field>
        <Field label="Status"><Select value={form.status} onChange={set("status")}>{["NEW", "CONTACTED", "REPLIED", "INTERESTED", "NEGOTIATING", "CUSTOMER", "NOT_INTERESTED", "DO_NOT_CONTACT", "ARCHIVED"].map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select></Field>
        <Field label="Timezone" description="IANA zone, e.g. America/New_York"><Input value={form.timezone} onChange={set("timezone")} /></Field>
        <Field label="Website"><Input value={form.website} onChange={set("website")} /></Field>
        <Field label="Email"><Input value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set("whatsapp")} /></Field>
        <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        <Field label="Region"><Input value={form.region} onChange={set("region")} /></Field>
        <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
        <Field label="Address"><Input value={form.address} onChange={set("address")} /></Field>
        <Field label="Add Instagram username"><Input value={form.instagramUsername} onChange={set("instagramUsername")} placeholder="@brand" /></Field>
        <Field label="Add Facebook page URL"><Input value={form.facebookUrl} onChange={set("facebookUrl")} /></Field>
        <Field label="Tags" className="sm:col-span-2"><Input value={form.tags} onChange={set("tags")} placeholder="comma separated" /></Field>
        <div className="sm:col-span-2"><Switch checked={form.doNotContact} onChange={(v) => setForm((f) => ({ ...f, doNotContact: v }))} label="Do not contact" description="Blocks all automated and scheduled messages to this client." /></div>
      </div>
    </Dialog>
  );
}
