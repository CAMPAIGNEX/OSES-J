"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Megaphone, Pause, Play, Plus, Square, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Skeleton, StatusBadge, Switch, Textarea } from "@/components/ui/primitives";
import { DataTable, KeyValue, type Column } from "@/components/ui/data";
import { Dialog, useToast } from "@/components/ui/overlay";

interface CampaignRow { id: string; name: string; status: string; channel: string; audienceType: string; firstMessageMode: string; messagesPerDay: number; requireApproval: boolean; startAt: string | null; startedAt: string | null; createdAt: string; stats: Record<string, unknown> | null; _count: { leads: number } }

export function CampaignsList() {
  const router = useRouter();
  const list = useQuery<{ items: CampaignRow[] }>("/api/campaigns?pageSize=100", { refreshInterval: 15_000 });
  const [creating, setCreating] = useState(false);
  const columns: Column<CampaignRow>[] = [
    { key: "name", header: "Campaign", render: (c) => <Link href={`/campaigns/${c.id}`} className="font-medium hover:underline">{c.name}</Link> },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "channel", header: "Channel", render: (c) => titleCase(c.channel) },
    { key: "audience", header: "Audience", render: (c) => `${c._count.leads} · ${titleCase(c.audienceType)}` },
    { key: "progress", header: "Progress", render: (c) => { const s = (c.stats ?? {}) as Record<string, number>; return <span className="text-muted">{s.contacted ?? 0} contacted · {s.replied ?? 0} replied · {s.pending ?? 0} pending</span>; } },
    { key: "limit", header: "Per day", align: "right", render: (c) => c.messagesPerDay },
    { key: "approval", header: "Approval", render: (c) => (c.requireApproval ? <Badge tone="warning">required</Badge> : <Badge tone="success">auto</Badge>) },
    { key: "created", header: "Created", render: (c) => <span className="text-muted">{formatDateTime(c.createdAt)}</span> },
  ];
  return (
    <div className="animate-in">
      <PageHeader title="Campaigns & Automations" description="Outreach sequences: first message plus scheduled follow-ups, within your working hours and daily limits." actions={<Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>New campaign</Button>} />
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <DataTable columns={columns} rows={list.data?.items ?? []} rowKey={(c) => c.id} loading={list.loading} onRowClick={(c) => router.push(`/campaigns/${c.id}`)} empty={<EmptyState icon={<Megaphone className="h-5 w-5" />} title="No campaigns yet" description="Create a campaign to contact a group of clients with AI-written first messages and automatic follow-ups." action={<Button size="sm" onClick={() => setCreating(true)}>New campaign</Button>} />} />
      </div>
      <CreateCampaignDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); router.push(`/campaigns/${id}`); }} />
    </div>
  );
}

function CreateCampaignDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: "", channel: "INSTAGRAM", audienceType: "CLIENTS", tag: "", status: "", firstMessageMode: "AI", template: "", followUps: "3, 7", workingStart: "10:00", workingEnd: "17:00", timezoneMode: "client", messagesPerDay: 30, requireApproval: true });
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      const res = await api<{ campaign: { id: string } }>("/api/campaigns", {
        body: {
          name: form.name,
          channel: form.channel,
          audienceType: form.audienceType,
          audienceFilter: { tag: form.tag || undefined, status: form.status || undefined },
          firstMessageMode: form.firstMessageMode,
          template: form.firstMessageMode === "TEMPLATE" ? form.template : null,
          followUps: form.followUps.split(",").map((x) => Number(x.trim())).filter((n) => n > 0).map((dayOffset) => ({ dayOffset })),
          workingHours: { enabled: true, start: form.workingStart, end: form.workingEnd },
          timezoneMode: form.timezoneMode,
          messagesPerDay: Number(form.messagesPerDay),
          requireApproval: form.requireApproval,
        },
      });
      toast.success("Campaign created");
      onCreated(res.campaign.id);
    } catch (err) {
      toast.error("Could not create campaign", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="New campaign" size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={() => void submit()} disabled={!form.name.trim()}>Create campaign</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="New York Streetwear Outreach" /></Field>
        <Field label="Channel"><Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}><option value="INSTAGRAM">Instagram</option><option value="FACEBOOK">Facebook</option></Select></Field>
        <Field label="Audience"><Select value={form.audienceType} onChange={(e) => setForm({ ...form, audienceType: e.target.value })}><option value="CLIENTS">Clients (filtered below)</option><option value="SAVED_LEADS">All saved leads (converted to clients)</option><option value="TAG">Clients with a tag</option></Select></Field>
        <Field label="Filter by tag"><Input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} placeholder="optional" /></Field>
        <Field label="Filter by client status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}><option value="">Any</option><option value="NEW">New</option><option value="CONTACTED">Contacted</option><option value="INTERESTED">Interested</option></Select></Field>
        <Field label="First message"><Select value={form.firstMessageMode} onChange={(e) => setForm({ ...form, firstMessageMode: e.target.value })}><option value="AI">AI generated per client</option><option value="TEMPLATE">Fixed template</option></Select></Field>
        <Field label="Follow-ups (days after first message)"><Input value={form.followUps} onChange={(e) => setForm({ ...form, followUps: e.target.value })} placeholder="3, 7" /></Field>
        {form.firstMessageMode === "TEMPLATE" && <Field label="Template" className="sm:col-span-2" description="Use {{brand}} for the brand name. Business rules still apply."><Textarea value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })} /></Field>}
        <Field label="Working hours start"><Input type="time" value={form.workingStart} onChange={(e) => setForm({ ...form, workingStart: e.target.value })} /></Field>
        <Field label="Working hours end"><Input type="time" value={form.workingEnd} onChange={(e) => setForm({ ...form, workingEnd: e.target.value })} /></Field>
        <Field label="Timezone"><Select value={form.timezoneMode} onChange={(e) => setForm({ ...form, timezoneMode: e.target.value })}><option value="client">Client&apos;s local time</option><option value="exporter">My company time</option></Select></Field>
        <Field label="Messages per day"><Input type="number" min={1} value={form.messagesPerDay} onChange={(e) => setForm({ ...form, messagesPerDay: Number(e.target.value) })} /></Field>
        <div className="sm:col-span-2"><Switch checked={form.requireApproval} onChange={(v) => setForm({ ...form, requireApproval: v })} label="Require my approval before each message is sent" description="Recommended. Messages appear in the Inbox as suggestions." /></div>
      </div>
    </Dialog>
  );
}

interface CampaignDetail { campaign: CampaignRow & { template: string | null; followUps: Array<{ dayOffset: number }> | null; workingHours: { start: string; end: string } | null; timezoneMode: string; leads: Array<{ id: string; status: string; currentStep: number; nextActionAt: string | null; conversationId: string | null; stopReason: string | null; client: { id: string; cid: string; brandName: string; status: string; country: string | null } }>; messageStats: Record<string, number>; replies: number } }

export function CampaignDetailView({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch } = useQuery<CampaignDetail>(`/api/campaigns/${id}`, { refreshInterval: 10_000 });
  const [busy, setBusy] = useState<string | null>(null);
  const c = data?.campaign;
  async function action(a: "start" | "pause" | "resume" | "cancel" | "complete") {
    setBusy(a);
    try {
      await api(`/api/campaigns/${id}/action`, { body: { action: a } });
      toast.success(`Campaign ${a === "start" || a === "resume" ? "running" : a + "d"}`);
      await refetch();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }
  if (loading && !c) return <Skeleton className="h-64" />;
  if (!c) return <p className="text-muted">Campaign not found.</p>;
  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={<Link href="/campaigns" className="hover:underline">Campaigns</Link>}
        title={<span className="flex items-center gap-2">{c.name} <StatusBadge status={c.status} /></span>}
        actions={
          <>
            {(c.status === "DRAFT" || c.status === "SCHEDULED") && <Button loading={busy === "start"} onClick={() => void action("start")} icon={<Play className="h-4 w-4" />}>Start</Button>}
            {c.status === "RUNNING" && <Button variant="outline" loading={busy === "pause"} onClick={() => void action("pause")} icon={<Pause className="h-4 w-4" />}>Pause</Button>}
            {c.status === "PAUSED" && <Button loading={busy === "resume"} onClick={() => void action("resume")} icon={<Play className="h-4 w-4" />}>Resume</Button>}
            {["RUNNING", "PAUSED", "SCHEDULED"].includes(c.status) && <Button variant="danger" loading={busy === "cancel"} onClick={() => void action("cancel")} icon={<Square className="h-4 w-4" />}>Stop campaign</Button>}
            <Button variant="ghost" onClick={() => void api(`/api/campaigns/${id}`, { method: "DELETE" }).then(() => router.push("/campaigns"))} icon={<Trash2 className="h-4 w-4" />} aria-label="Delete" />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" padded={false}>
          <div className="p-5 pb-3"><CardHeader title={`Audience (${c.leads.length})`} className="mb-0" /></div>
          <table className="w-full text-[13px]">
            <thead><tr className="border-t border-default bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted"><th className="px-5 py-2">Client</th><th>Status</th><th>Step</th><th>Next action</th><th></th></tr></thead>
            <tbody>
              {c.leads.map((l) => (
                <tr key={l.id} className="border-t border-default">
                  <td className="px-5 py-2"><Link href={`/clients/${l.client.cid}`} className="font-medium hover:underline">{l.client.brandName}</Link> <span className="font-mono text-[11px] text-faint">{l.client.cid}</span></td>
                  <td><StatusBadge status={l.status} />{l.stopReason && <span className="ml-1 text-xs text-faint">{l.stopReason}</span>}</td>
                  <td>{l.currentStep}</td>
                  <td className="text-muted">{l.nextActionAt ? formatDateTime(l.nextActionAt) : "—"}</td>
                  <td className="pr-5 text-right">{l.conversationId && <Link href={`/inbox/${l.conversationId}`} className="text-brand-600 hover:underline">Conversation</Link>}</td>
                </tr>
              ))}
              {!c.leads.length && <tr><td colSpan={5} className="px-5 py-6 text-center text-muted">Audience is materialized when the campaign starts.</td></tr>}
            </tbody>
          </table>
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Setup" />
            <KeyValue items={[{ label: "Channel", value: titleCase(c.channel) }, { label: "Audience", value: titleCase(c.audienceType) }, { label: "First message", value: c.firstMessageMode === "AI" ? "AI generated" : "Template" }, { label: "Follow-ups", value: (c.followUps ?? []).map((f) => `day ${f.dayOffset}`).join(", ") || "none" }, { label: "Working hours", value: c.workingHours ? `${c.workingHours.start}–${c.workingHours.end} (${c.timezoneMode})` : "—" }, { label: "Daily limit", value: c.messagesPerDay }, { label: "Approval", value: c.requireApproval ? "Required" : "Automatic" }]} />
          </Card>
          <Card>
            <CardHeader title="Results" />
            <KeyValue items={[{ label: "Messages", value: Object.entries(c.messageStats).map(([k, v]) => `${titleCase(k)} ${v}`).join(" · ") || "0" }, { label: "Replies", value: c.replies }, { label: "Started", value: c.startedAt ? formatDateTime(c.startedAt) : "—" }]} />
          </Card>
        </div>
      </div>
    </div>
  );
}
