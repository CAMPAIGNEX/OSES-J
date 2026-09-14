"use client";

import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { api, qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, timeAgo, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, EmptyState, Select } from "@/components/ui/primitives";
import { DataTable, Pagination, type Column } from "@/components/ui/data";
import { ConfirmDialog, useToast } from "@/components/ui/overlay";

interface TrashRow { id: string; entityType: string; entityId: string; label: string; deletedAt: string; purgeAt: string }
interface TrashPage { items: TrashRow[]; page: number; pageSize: number; total: number; totalPages: number }

export function TrashView() {
  const toast = useToast();
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [purge, setPurge] = useState<TrashRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const trash = useQuery<TrashPage>(`/api/trash${qs({ entityType: type, page, pageSize: 50 })}`);
  async function restore(row: TrashRow) {
    setBusy(row.id);
    try {
      await api(`/api/trash/${row.entityType.toLowerCase()}/${row.entityId}/restore`, { method: "POST" });
      toast.success(`${titleCase(row.entityType)} restored`);
      await trash.refetch();
    } catch (err) {
      toast.error("Restore failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }
  async function purgeNow() {
    if (!purge) return;
    setBusy(purge.id);
    try {
      await api(`/api/trash/${purge.entityType.toLowerCase()}/${purge.entityId}`, { method: "DELETE" });
      toast.info("Permanently deleted");
      setPurge(null);
      await trash.refetch();
    } catch (err) {
      toast.error("Delete failed", err instanceof Error ? err.message : undefined);
    } finally {
      setBusy(null);
    }
  }
  const columns: Column<TrashRow>[] = [
    { key: "label", header: "Item", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "type", header: "Type", render: (r) => <Badge>{titleCase(r.entityType)}</Badge> },
    { key: "deleted", header: "Deleted", render: (r) => <span className="text-muted">{formatDateTime(r.deletedAt)}</span> },
    { key: "purge", header: "Permanently deleted", render: (r) => <span className="text-muted">{timeAgo(r.purgeAt)}</span> },
    { key: "actions", header: "", align: "right", render: (r) => <div className="flex justify-end gap-1"><Button size="xs" variant="outline" loading={busy === r.id} onClick={() => void restore(r)} icon={<RotateCcw className="h-3.5 w-3.5" />}>Restore</Button><Button size="xs" variant="ghost" className="text-red-600" onClick={() => setPurge(r)} icon={<Trash2 className="h-3.5 w-3.5" />}>Delete now</Button></div> },
  ];
  return (
    <div className="animate-in">
      <PageHeader title="Trash" description="Deleted clients, leads, documents, campaigns and notes stay here for 7 days before they are permanently removed." actions={<Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="w-40"><option value="">All types</option>{["CLIENT", "LEAD", "DOCUMENT", "CAMPAIGN", "NOTE", "CONVERSATION", "SAVED_SEARCH"].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>} />
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <DataTable columns={columns} rows={trash.data?.items ?? []} rowKey={(r) => r.id} loading={trash.loading} empty={<EmptyState icon={<Trash2 className="h-5 w-5" />} title="Trash is empty" />} />
      </div>
      {trash.data && <Pagination className="mt-3" page={trash.data.page} totalPages={trash.data.totalPages} total={trash.data.total} pageSize={trash.data.pageSize} onPage={setPage} />}
      <ConfirmDialog open={Boolean(purge)} onClose={() => setPurge(null)} onConfirm={purgeNow} title="Delete permanently?" description={purge ? `"${purge.label}" will be deleted immediately. This cannot be undone.` : undefined} confirmLabel="Delete permanently" tone="danger" loading={Boolean(busy)} />
    </div>
  );
}
