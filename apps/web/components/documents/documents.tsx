"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Download, FileText, Trash2, Upload } from "@/components/ui/icons";
import { api, qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime, titleCase } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, StatusBadge, Switch, cn } from "@/components/ui/primitives";
import { DataTable, Pagination, type Column } from "@/components/ui/data";
import { Dialog, useToast } from "@/components/ui/overlay";
import { FeatureGuide } from "@/components/layout/feature-guide";

interface Doc { id: string; name: string; originalName: string; mimeType: string; sizeBytes: number; kind: string; createdAt: string; client: { cid: string; brandName: string } | null; knowledgeDocument: { status: string; chunkCount: number; error: string | null } | null }
interface DocPage { items: Doc[]; page: number; pageSize: number; total: number; totalPages: number }

const KINDS = ["CATALOG", "PRICE_LIST", "COMPANY_PROFILE", "MOQ_SHEET", "SIZE_CHART", "PRODUCTION_INFO", "KNOWLEDGE", "OTHER"];

export function DocumentsView() {
  const params = useSearchParams();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const clientId = params.get("clientId") ?? "";
  const docs = useQuery<DocPage>(`/api/documents${qs({ page, pageSize: 50, kind, q, clientId })}`, { refreshInterval: 8000 });
  const [uploadOpen, setUploadOpen] = useState(false);
  const columns: Column<Doc>[] = [
    { key: "name", header: "Document", render: (d) => <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-faint" /><div><p className="font-medium">{d.name}</p>{d.name !== d.originalName && <p className="text-xs text-faint">{d.originalName}</p>}</div></div> },
    { key: "kind", header: "Type", render: (d) => <Badge>{titleCase(d.kind)}</Badge> },
    { key: "client", header: "Client", render: (d) => (d.client ? <span>{d.client.brandName} <span className="font-mono text-[11px] text-faint">{d.client.cid}</span></span> : <span className="text-faint">Company</span>) },
    { key: "knowledge", header: "AI knowledge", render: (d) => (d.knowledgeDocument ? <span className="flex items-center gap-1"><StatusBadge status={d.knowledgeDocument.status} />{d.knowledgeDocument.status === "READY" && <span className="text-xs text-faint">{d.knowledgeDocument.chunkCount} chunks</span>}{d.knowledgeDocument.error && <span className="text-xs text-red-600">{d.knowledgeDocument.error}</span>}</span> : <span className="text-faint">—</span>) },
    { key: "size", header: "Size", align: "right", render: (d) => <span className="tabular text-muted">{(d.sizeBytes / 1024).toFixed(0)} KB</span> },
    { key: "date", header: "Uploaded", render: (d) => <span className="text-muted">{formatDateTime(d.createdAt)}</span> },
    { key: "actions", header: "", align: "right", render: (d) => <div className="flex justify-end gap-1"><Button size="xs" variant="ghost" href={`/api/documents/${d.id}/download`} icon={<Download className="h-3.5 w-3.5" />}>Download</Button><Button size="xs" variant="ghost" onClick={() => void api(`/api/documents/${d.id}`, { method: "DELETE" }).then(() => { toast.info("Moved to trash"); void docs.refetch(); })} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Delete" /></div> },
  ];
  return (
    <div className="animate-in">
      <PageHeader title="Documents" description="Catalogs, price lists, size charts and company profiles. Attach them to clients or add text files to the AI knowledge base." actions={<Button onClick={() => setUploadOpen(true)} icon={<Upload className="h-4 w-4" />}>Upload</Button>} />
      <FeatureGuide id="documents" />
      <Card className="mb-4" padded={false}>
        <div className="flex flex-wrap gap-2 p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="max-w-xs" />
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-44"><option value="">All types</option>{KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</Select>
        </div>
      </Card>
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <DataTable columns={columns} rows={docs.data?.items ?? []} rowKey={(d) => d.id} loading={docs.loading} empty={<EmptyState icon={<FileText className="h-5 w-5" />} title="No documents" description="Upload your catalog and price list so you can attach them to conversations." action={<Button size="sm" onClick={() => setUploadOpen(true)}>Upload</Button>} />} />
      </div>
      {docs.data && <Pagination className="mt-3" page={docs.data.page} totalPages={docs.data.totalPages} total={docs.data.total} pageSize={docs.data.pageSize} onPage={setPage} />}
      <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} clientId={clientId} onDone={() => { setUploadOpen(false); void docs.refetch(); }} />
    </div>
  );
}

function UploadDialog({ open, onClose, onDone, clientId }: { open: boolean; onClose: () => void; onDone: () => void; clientId: string }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState("CATALOG");
  const [title, setTitle] = useState("");
  const [knowledge, setKnowledge] = useState(false);
  const [loading, setLoading] = useState(false);
  const textFile = file ? /\.(txt|md|csv|json)$/i.test(file.name) : false;
  async function upload() {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      if (title) fd.append("title", title);
      if (clientId) fd.append("clientId", clientId);
      if (knowledge && textFile) fd.append("addToKnowledge", "true");
      await api("/api/documents", { method: "POST", body: fd, raw: true });
      toast.success("Uploaded");
      setFile(null);
      setTitle("");
      onDone();
    } catch (err) {
      toast.error("Upload failed", err instanceof Error ? err.message : undefined);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="Upload document" description="TXT, Markdown, CSV, PDF, DOCX, XLSX or images up to 25 MB." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button loading={loading} disabled={!file} onClick={() => void upload()}>Upload</Button></>}>
      <div className="space-y-3">
        <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-strong px-3 py-6 text-[13px] text-muted hover:bg-surface-2")}>
          <Upload className="h-5 w-5" />
          {file ? <span className="font-medium text-body">{file.name}</span> : "Choose a file"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp" />
        </label>
        <Field label="Title (optional)"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={file?.name ?? "Sportswear Catalog 2026"} /></Field>
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map((k) => <option key={k} value={k}>{titleCase(k)}</option>)}</Select></Field>
        <Switch checked={knowledge} onChange={setKnowledge} disabled={!textFile} label="Add to AI knowledge base" description={textFile ? "The text is chunked and used to answer client questions." : "Available for TXT, Markdown, CSV and JSON files."} />
      </div>
    </Dialog>
  );
}
