"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, Building2, Download, ExternalLink, Globe, Mail, MessageCircle, Phone, Tag, Trash2, Eye } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { formatCompact } from "@/lib/format";
import { Badge, Button, StatusBadge, cn } from "@/components/ui/primitives";
import { DataTable, Pagination, type Column } from "@/components/ui/data";
import { ConfirmDialog, useToast } from "@/components/ui/overlay";

export interface LeadRow {
  id: string;
  brandName: string;
  name: string | null;
  primaryPlatform: string | null;
  username: string | null;
  profileUrl: string | null;
  followers: number | null;
  country: string | null;
  region: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  websiteDomain: string | null;
  leadScore: number;
  status: string;
  isSaved: boolean;
  clientId: string | null;
  enrichmentStatus: string;
  tags: Array<{ tag: { id: string; name: string; color: string | null } }>;
}

export interface LeadPage {
  items: LeadRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-brand-500" : "bg-amber-500";
  return (
    <div className="flex items-center gap-2" title={`Lead score ${score}/100`}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${score}%` }} />
      </div>
      <span className="tabular text-xs text-muted">{score}</span>
    </div>
  );
}

export function LeadsTable({ data, loading, onChanged, onPage, emptyMessage, searchLocation }: { data: LeadPage | undefined; loading: boolean; onChanged: () => void; onPage: (p: number) => void; emptyMessage?: React.ReactNode; searchLocation?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const rows = useMemo(() => data?.items ?? [], [data]);

  const toggle = useCallback((id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  }), []);
  const toggleAll = useCallback((ids: string[]) => setSelected((s) => (ids.every((id) => s.has(id)) ? new Set() : new Set(ids))), []);
  const ids = [...selected];

  async function run(action: string, fn: () => Promise<void>) {
    setBusy(action);
    try {
      await fn();
      onChanged();
    } catch (err) {
      toast.error("Action failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const saveLeads = (leadIds: string[]) => run("save", async () => {
    const res = await api<{ count: number }>("/api/leads/save", { body: { leadIds } });
    toast.success(`${res.count} lead${res.count === 1 ? "" : "s"} saved`);
  });
  const unsaveLeads = (leadIds: string[]) => run("unsave", async () => {
    await api("/api/leads/unsave", { body: { leadIds } });
    toast.info("Removed from saved leads");
  });
  const addToBusiness = (leadIds: string[]) => run("add", async () => {
    const res = await api<{ created: Array<{ cid: string }>; existing: Array<{ cid: string; matchedBy: string }>; restored: Array<{ cid: string }> }>("/api/clients/add-to-business", { body: { leadIds } });
    const parts: string[] = [];
    if (res.created.length) parts.push(`${res.created.length} new client${res.created.length === 1 ? "" : "s"} (${res.created.map((c) => c.cid).slice(0, 3).join(", ")}${res.created.length > 3 ? "…" : ""})`);
    if (res.existing.length) parts.push(`${res.existing.length} already existed (${res.existing.map((c) => c.cid).slice(0, 3).join(", ")})`);
    if (res.restored.length) parts.push(`${res.restored.length} restored from trash`);
    if (res.created.length) toast.success("Added to business", parts.join(" · "));
    else toast.info("Already in your clients", parts.join(" · ") || "No new clients were created");
    setSelected(new Set());
    if (leadIds.length === 1) {
      const cid = res.created[0]?.cid ?? res.existing[0]?.cid ?? res.restored[0]?.cid;
      if (cid) router.push(`/clients/${cid}`);
    }
  });
  const deleteLeads = (leadIds: string[]) => run("delete", async () => {
    const res = await api<{ count: number }>("/api/leads/delete", { body: { leadIds } });
    toast.info(`${res.count} lead${res.count === 1 ? "" : "s"} moved to trash`);
    setSelected(new Set());
    setConfirmDelete(false);
  });
  const tagLeads = (leadIds: string[]) => {
    const tag = window.prompt("Tag name");
    if (!tag) return;
    void run("tag", async () => {
      await api("/api/leads/tags", { body: { leadIds, tag } });
      toast.success(`Tagged ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`);
    });
  };
  async function exportSelected(leadIds: string[]) {
    setBusy("export");
    try {
      const blob = await api<Blob>("/api/leads/export", { body: { leadIds, scope: "selected" } });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }

  const columns: Column<LeadRow>[] = [
    {
      key: "brand",
      header: "Brand",
      render: (l) => (
        <div className="min-w-0">
          <Link href={`/leads/${l.id}`} className="block truncate font-medium text-body hover:underline">
            {l.brandName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {l.tags.slice(0, 3).map((t) => (
              <Badge key={t.tag.id}>{t.tag.name}</Badge>
            ))}
            {l.enrichmentStatus === "RUNNING" || l.enrichmentStatus === "PENDING" ? <Badge tone="brand" dot>enriching</Badge> : null}
          </div>
        </div>
      ),
    },
    { key: "platform", header: "Platform", render: (l) => <span className="text-muted">{l.primaryPlatform === "INSTAGRAM" ? "Instagram" : l.primaryPlatform === "FACEBOOK" ? "Facebook" : "—"}</span> },
    {
      key: "username",
      header: "Username",
      render: (l) =>
        l.profileUrl ? (
          <a href={l.profileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
            {l.username ? `@${l.username}` : "profile"} <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-faint">—</span>
        ),
    },
    { key: "followers", header: "Followers", align: "right", render: (l) => <span className="tabular">{l.followers == null ? <span className="text-faint" title="Not provided by the source yet">—</span> : formatCompact(l.followers)}</span> },
    {
      key: "location",
      header: "Location",
      render: (l) => {
        const own = [l.city, l.region, l.country].filter(Boolean).join(", ");
        if (own) return <span>{own}</span>;
        return searchLocation ? <span className="text-faint" title="From the search criteria, not verified on the profile">{searchLocation} (search)</span> : <span className="text-faint">—</span>;
      },
    },
    { key: "email", header: "Email", render: (l) => (l.email ? <a href={`mailto:${l.email}`} className="inline-flex items-center gap-1 hover:underline" onClick={(e) => e.stopPropagation()}><Mail className="h-3 w-3 text-faint" />{l.email}</a> : <span className="text-faint">—</span>) },
    { key: "phone", header: "Phone", render: (l) => (l.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-faint" />{l.phone}</span> : <span className="text-faint">—</span>) },
    { key: "whatsapp", header: "WhatsApp", render: (l) => (l.whatsapp ? <a href={`https://wa.me/${l.whatsapp.replace("+", "")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600 hover:underline" onClick={(e) => e.stopPropagation()}><MessageCircle className="h-3 w-3" />{l.whatsapp}</a> : <span className="text-faint">—</span>) },
    { key: "website", header: "Website", render: (l) => (l.website ? <a href={l.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline" onClick={(e) => e.stopPropagation()}><Globe className="h-3 w-3 text-faint" />{l.websiteDomain ?? l.website}</a> : <span className="text-faint">—</span>) },
    { key: "score", header: "Score", render: (l) => <ScoreBar score={l.leadScore} /> },
    { key: "status", header: "Status", render: (l) => (l.clientId ? <Badge tone="success">Client</Badge> : l.isSaved ? <Badge tone="brand">Saved</Badge> : <StatusBadge status={l.status} />) },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (l) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {l.isSaved ? (
            <Button size="xs" variant="ghost" title="Remove from saved" onClick={() => void unsaveLeads([l.id])} icon={<BookmarkCheck className="h-3.5 w-3.5 text-brand-600" />} />
          ) : (
            <Button size="xs" variant="ghost" title="Save lead" onClick={() => void saveLeads([l.id])} icon={<Bookmark className="h-3.5 w-3.5" />} />
          )}
          {l.clientId ? (
            <Button size="xs" variant="outline" href={`/clients?q=${encodeURIComponent(l.brandName)}`} icon={<Building2 className="h-3.5 w-3.5" />}>
              Open client
            </Button>
          ) : (
            <Button size="xs" variant="outline" onClick={() => void addToBusiness([l.id])} icon={<Building2 className="h-3.5 w-3.5" />}>
              Add to Business
            </Button>
          )}
          <Button size="xs" variant="ghost" href={`/leads/${l.id}`} title="View" icon={<Eye className="h-3.5 w-3.5" />} />
        </div>
      ),
    },
  ];

  return (
    <div>
      {ids.length > 0 && (
        <div className="animate-in mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-[13px] dark:border-brand-800 dark:bg-brand-900/30">
          <span className="font-medium text-brand-700 dark:text-brand-100">{ids.length} selected</span>
          <span className="mx-1 h-4 w-px bg-brand-200 dark:bg-brand-800" />
          <Button size="xs" variant="outline" loading={busy === "save"} onClick={() => void saveLeads(ids)} icon={<Bookmark className="h-3.5 w-3.5" />}>
            Save
          </Button>
          <Button size="xs" loading={busy === "add"} onClick={() => void addToBusiness(ids)} icon={<Building2 className="h-3.5 w-3.5" />}>
            Add to Business
          </Button>
          <Button size="xs" variant="outline" loading={busy === "export"} onClick={() => void exportSelected(ids)} icon={<Download className="h-3.5 w-3.5" />}>
            Export XLSX
          </Button>
          <Button size="xs" variant="outline" loading={busy === "tag"} onClick={() => tagLeads(ids)} icon={<Tag className="h-3.5 w-3.5" />}>
            Tag
          </Button>
          <Button size="xs" variant="ghost" className="text-red-600" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-3.5 w-3.5" />}>
            Delete
          </Button>
          <Button size="xs" variant="ghost" className="ml-auto" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <DataTable columns={columns} rows={rows} rowKey={(l) => l.id} loading={loading} selectable selected={selected} onToggle={toggle} onToggleAll={toggleAll} onRowClick={(l) => router.push(`/leads/${l.id}`)} empty={emptyMessage} />
      </div>
      {data && <Pagination className="mt-3" page={data.page} totalPages={data.totalPages} total={data.total} pageSize={data.pageSize} onPage={onPage} />}
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => deleteLeads(ids)} title="Move leads to trash?" description={`${ids.length} lead${ids.length === 1 ? "" : "s"} will be moved to the trash and permanently deleted after 7 days.`} confirmLabel="Move to trash" tone="danger" loading={busy === "delete"} />
    </div>
  );
}
