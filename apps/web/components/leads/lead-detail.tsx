"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Building2, ExternalLink, Info, Trash2 } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatCompact, formatDateTime, platformName, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, CardHeader, Skeleton, StatusBadge, Textarea } from "@/components/ui/primitives";
import { KeyValue } from "@/components/ui/data";
import { ConfirmDialog, useToast } from "@/components/ui/overlay";

interface LeadDetail {
  lead: {
    id: string;
    brandName: string;
    name: string | null;
    username: string | null;
    primaryPlatform: string | null;
    profileUrl: string | null;
    inboxUrl: string | null;
    externalId: string | null;
    followers: number | null;
    following: number | null;
    postsCount: number | null;
    bio: string | null;
    website: string | null;
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    address: string | null;
    category: string | null;
    source: string | null;
    sourceActor: string | null;
    sourceTimestamp: string | null;
    timezone: string | null;
    leadScore: number;
    scoreBreakdown: { parts?: Record<string, number>; notes?: string[] } | null;
    status: string;
    isSaved: boolean;
    enrichmentStatus: string;
    enrichmentError: string | null;
    notes: string | null;
    createdAt: string;
    client: { id: string; cid: string; status: string } | null;
    socialAccounts: Array<{ id: string; platform: string; username: string | null; profileUrl: string; externalId: string | null; inboxUrl: string | null; followers: number | null; bio: string | null; category: string | null; isBusiness: boolean | null; isVerified: boolean | null; isPrivate: boolean | null; sourceProvider: string; sourceActor: string | null; fetchedAt: string; raw: unknown }>;
    contacts: Array<{ id: string; type: string; value: string; source: string; sourceUrl: string | null; confidence: string; label: string | null }>;
    tags: Array<{ tag: { id: string; name: string } }>;
    searchRuns: Array<{ rank: number; matchedExisting: boolean; matchedBy: string | null; searchRun: { id: string; query: string; createdAt: string } }>;
  };
}

export function LeadDetailView({ leadId }: { leadId: string }) {
  const router = useRouter();
  const toast = useToast();
  const { data, loading, refetch, setData } = useQuery<LeadDetail>(`/api/leads/${leadId}`);
  const [notes, setNotes] = useState<string | null>(null);
  const [tags, setTags] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRaw, setShowRaw] = useState<string | null>(null);
  const lead = data?.lead;

  async function saveMeta() {
    if (!lead) return;
    setSaving(true);
    try {
      const res = await api<LeadDetail>(`/api/leads/${lead.id}`, { method: "PATCH", body: { notes: notes ?? lead.notes, tags: tags !== null ? tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined } });
      setData(res);
      toast.success("Saved");
    } catch (err) {
      toast.error("Could not save", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(false);
    }
  }
  async function toggleSaved() {
    if (!lead) return;
    await api(lead.isSaved ? "/api/leads/unsave" : "/api/leads/save", { body: { leadIds: [lead.id] } });
    void refetch();
  }
  async function addToBusiness() {
    if (!lead) return;
    const res = await api<{ created: Array<{ cid: string }>; existing: Array<{ cid: string }>; restored: Array<{ cid: string }> }>("/api/clients/add-to-business", { body: { leadIds: [lead.id] } });
    const cid = res.created[0]?.cid ?? res.existing[0]?.cid ?? res.restored[0]?.cid;
    if (res.existing.length) toast.info(`Already exists as ${res.existing[0]!.cid}`);
    else toast.success(`Client ${cid} created`);
    if (cid) router.push(`/clients/${cid}`);
  }
  async function trash() {
    if (!lead) return;
    await api("/api/leads/delete", { body: { leadIds: [lead.id] } });
    toast.info("Lead moved to trash");
    router.push("/leads/saved");
  }

  if (loading && !lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (!lead) return <p className="text-muted">Lead not found.</p>;
  const parts = lead.scoreBreakdown?.parts ?? {};

  return (
    <div className="animate-in">
      <PageHeader
        breadcrumb={<Link href="/leads/saved" className="hover:underline">Leads</Link>}
        title={lead.brandName}
        description={[lead.category, lead.username ? `@${lead.username}` : null, [lead.city, lead.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" onClick={() => void toggleSaved()} icon={lead.isSaved ? <BookmarkCheck className="h-4 w-4 text-brand-600" /> : <Bookmark className="h-4 w-4" />}>
              {lead.isSaved ? "Saved" : "Save"}
            </Button>
            {lead.client ? (
              <Button href={`/clients/${lead.client.cid}`} icon={<Building2 className="h-4 w-4" />}>
                Open client {lead.client.cid}
              </Button>
            ) : (
              <Button onClick={() => void addToBusiness()} icon={<Building2 className="h-4 w-4" />}>
                Add to Business
              </Button>
            )}
            <Button variant="ghost" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" />} aria-label="Delete" />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Profile" actions={<StatusBadge status={lead.client ? "ADDED" : lead.isSaved ? "SAVED" : lead.status} />} />
            <KeyValue
              columns={2}
              items={[
                { label: "Platform", value: platformName(lead.primaryPlatform) },
                { label: "Username", value: lead.profileUrl ? <a href={lead.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">{lead.username ? `@${lead.username}` : lead.profileUrl}<ExternalLink className="h-3 w-3" /></a> : lead.username },
                { label: "Followers", value: lead.followers == null ? null : `${formatCompact(lead.followers)}${lead.following != null ? ` · following ${formatCompact(lead.following)}` : ""}${lead.postsCount != null ? ` · ${lead.postsCount} posts` : ""}` },
                { label: "Website", value: lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{lead.website}</a> : null },
                { label: "Email", value: lead.email },
                { label: "Phone", value: lead.phone },
                { label: "WhatsApp", value: lead.whatsapp },
                { label: "Location", value: [lead.address, lead.city, lead.region, lead.country].filter(Boolean).join(", ") || null },
                { label: "Timezone", value: lead.timezone },
                { label: "Inbox reference", value: lead.inboxUrl ? <span className="break-all text-muted">{lead.inboxUrl}</span> : null },
              ]}
            />
            {lead.bio && (
              <div className="mt-4 border-t border-default pt-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-faint">Bio</p>
                <p className="mt-1 whitespace-pre-wrap text-[13px]">{lead.bio}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Contacts & sources" description="Every contact field shows where it came from and how confident we are. Nothing here is inferred by AI." />
            {lead.contacts.length ? (
              <ul className="divide-y divide-[var(--border)]">
                {lead.contacts.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-[13px]">
                    <Badge>{titleCase(c.type)}</Badge>
                    <span className="min-w-0 flex-1 break-all font-medium">{c.value}</span>
                    <span className="text-xs text-muted">Source: {titleCase(c.source)}{c.label ? ` (${c.label})` : ""}</span>
                    <StatusBadge status={c.confidence} />
                    {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">view</a>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">No contact details found yet{lead.enrichmentStatus === "RUNNING" || lead.enrichmentStatus === "PENDING" ? " — enrichment is running." : "."}</p>
            )}
          </Card>

          <Card>
            <CardHeader title="Social accounts" />
            <ul className="space-y-3">
              {lead.socialAccounts.map((a) => (
                <li key={a.id} className="rounded-lg border border-default p-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="brand">{platformName(a.platform)}</Badge>
                    <a href={a.profileUrl} target="_blank" rel="noreferrer" className="font-medium text-brand-600 hover:underline">{a.username ? `@${a.username}` : a.profileUrl}</a>
                    {a.isBusiness && <Badge tone="info">business</Badge>}
                    {a.isVerified && <Badge tone="success">verified</Badge>}
                    {a.isPrivate && <Badge tone="warning">private</Badge>}
                    <span className="ml-auto text-xs text-faint">via {a.sourceProvider}{a.sourceActor ? ` · ${a.sourceActor}` : ""} · {formatDateTime(a.fetchedAt)}</span>
                  </div>
                  {a.externalId && <p className="mt-1 text-xs text-muted">External id: {a.externalId}</p>}
                  <button type="button" className="mt-1 text-xs text-brand-600 hover:underline" onClick={() => setShowRaw(showRaw === a.id ? null : a.id)}>{showRaw === a.id ? "Hide" : "Show"} raw provider data</button>
                  {showRaw === a.id && <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-surface-2 p-2 text-[11px]">{JSON.stringify(a.raw, null, 2)}</pre>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title={`Lead score ${lead.leadScore}/100`} />
            <ul className="space-y-1.5 text-[13px]">
              {Object.entries(parts).map(([k, v]) => (
                <li key={k} className="flex items-center justify-between">
                  <span className="capitalize text-muted">{k}</span>
                  <span className="tabular font-medium">{v > 0 ? `+${v}` : v}</span>
                </li>
              ))}
            </ul>
            {lead.scoreBreakdown?.notes?.length ? <p className="mt-3 flex items-start gap-1.5 text-xs text-faint"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{lead.scoreBreakdown.notes.join(" · ")}</p> : null}
          </Card>
          <Card>
            <CardHeader title="Notes & tags" />
            <Textarea value={notes ?? lead.notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes about this lead" />
            <input className="mt-2 h-9 w-full rounded-lg border border-strong bg-surface px-3 text-sm" value={tags ?? lead.tags.map((t) => t.tag.name).join(", ")} onChange={(e) => setTags(e.target.value)} placeholder="Tags, comma separated" />
            <Button className="mt-2 w-full" variant="outline" loading={saving} onClick={() => void saveMeta()}>Save notes & tags</Button>
          </Card>
          <Card>
            <CardHeader title="Discovery history" />
            <ul className="space-y-2 text-[13px]">
              <li className="text-muted">Source: {lead.source ?? "—"}{lead.sourceActor ? ` (${lead.sourceActor})` : ""}</li>
              <li className="text-muted">Enrichment: <StatusBadge status={lead.enrichmentStatus} />{lead.enrichmentError ? <span className="ml-1 text-xs text-red-600">{lead.enrichmentError}</span> : null}</li>
              {lead.searchRuns.map((sr) => (
                <li key={sr.searchRun.id}>
                  <Link href={`/leads/search/${sr.searchRun.id}`} className="hover:underline">{sr.searchRun.query}</Link>
                  <span className="text-xs text-faint"> · #{sr.rank} · {formatDateTime(sr.searchRun.createdAt)}{sr.matchedExisting ? ` · matched existing (${sr.matchedBy})` : ""}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={trash} title="Move lead to trash?" description="It can be restored from the Trash within 7 days." confirmLabel="Move to trash" tone="danger" />
    </div>
  );
}
