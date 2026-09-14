"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, Search, Users } from "@/components/ui/icons";
import { api, ApiError, qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatCompact, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, Button, Card, EmptyState, Field, Input, Select, StatusBadge, Textarea } from "@/components/ui/primitives";
import { DataTable, Pagination, type Column } from "@/components/ui/data";
import { Dialog, useToast } from "@/components/ui/overlay";

interface ClientRow {
  id: string;
  cid: string;
  brandName: string;
  companyName: string | null;
  category: string | null;
  country: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  followers: number | null;
  leadScore: number;
  status: string;
  doNotContact: boolean;
  lastActivityAt: string | null;
  lastContactedAt: string | null;
  lastReplyAt: string | null;
  socialAccounts: Array<{ id: string; platform: string; username: string | null; messagingEligibility: string }>;
  tags: Array<{ tag: { id: string; name: string } }>;
  _count: { conversations: number };
}
interface ClientPage {
  items: ClientRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const STATUSES = ["NEW", "CONTACTED", "REPLIED", "INTERESTED", "NEGOTIATING", "CUSTOMER", "NOT_INTERESTED", "DO_NOT_CONTACT", "ARCHIVED"];

export function ClientsList() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [sort, setSort] = useState("newest");
  const [applied, setApplied] = useState(q);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setApplied(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [applied, status, sort]);
  const clients = useQuery<ClientPage>(`/api/clients${qs({ q: applied, status, sort, page, pageSize: 50 })}`);

  const columns: Column<ClientRow>[] = [
    { key: "cid", header: "CID", width: "110px", render: (c) => <Link href={`/clients/${c.cid}`} className="font-mono text-[12px] font-semibold text-brand-600 hover:underline">{c.cid}</Link> },
    {
      key: "brand",
      header: "Brand",
      render: (c) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{c.brandName}</p>
          <p className="truncate text-xs text-faint">{[c.companyName, c.category].filter(Boolean).join(" · ") || "—"}</p>
        </div>
      ),
    },
    {
      key: "channels",
      header: "Channels",
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.socialAccounts.map((a) => (
            <Badge key={a.id} tone={a.messagingEligibility === "MESSAGEABLE" ? "success" : a.messagingEligibility === "NOT_MESSAGEABLE" ? "danger" : "neutral"} className="font-normal">
              {a.platform === "INSTAGRAM" ? "IG" : "FB"}{a.username ? ` @${a.username}` : ""}
            </Badge>
          ))}
          {!c.socialAccounts.length && <span className="text-faint">—</span>}
        </div>
      ),
    },
    { key: "location", header: "Location", render: (c) => [c.city, c.country].filter(Boolean).join(", ") || <span className="text-faint">—</span> },
    { key: "contact", header: "Contact", render: (c) => (c.email || c.phone ? <span className="text-muted">{c.email ?? c.phone}</span> : <span className="text-faint">—</span>) },
    { key: "followers", header: "Followers", align: "right", render: (c) => <span className="tabular">{formatCompact(c.followers)}</span> },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    { key: "activity", header: "Last activity", render: (c) => <span className="text-muted">{timeAgo(c.lastActivityAt)}</span> },
    { key: "tags", header: "Tags", render: (c) => (c.tags.length ? <div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t.tag.id}>{t.tag.name}</Badge>)}</div> : <span className="text-faint">—</span>) },
  ];

  return (
    <div className="animate-in">
      <PageHeader title="Clients" description="Every prospect you added to your business, with a permanent client ID." actions={<Button onClick={() => setCreating(true)} icon={<Plus className="h-4 w-4" />}>New client</Button>} />
      <Card className="mb-4" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search CID, brand, username, email…" className="pl-9" />
          </div>
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (ch) => ch.toUpperCase())}
              </option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-40">
            <option value="newest">Newest</option>
            <option value="activity">Recent activity</option>
            <option value="cid">CID</option>
            <option value="name">Name</option>
            <option value="score">Lead score</option>
          </Select>
        </div>
      </Card>
      <div className="card overflow-hidden" style={{ padding: 0 }}>
        <DataTable columns={columns} rows={clients.data?.items ?? []} rowKey={(c) => c.id} loading={clients.loading} onRowClick={(c) => router.push(`/clients/${c.cid}`)} empty={<EmptyState icon={<Users className="h-5 w-5" />} title="No clients yet" description="Save leads from a search and click “Add to Business” to create clients with a CID." action={<Button href="/leads/search" size="sm">Search leads</Button>} />} />
      </div>
      {clients.data && <Pagination className="mt-3" page={clients.data.page} totalPages={clients.data.totalPages} total={clients.data.total} pageSize={clients.data.pageSize} onPage={setPage} />}
      <CreateClientDialog open={creating} onClose={() => setCreating(false)} onCreated={(cid) => { setCreating(false); toast.success(`Client ${cid} created`); router.push(`/clients/${cid}`); }} />
    </div>
  );
}

function CreateClientDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (cid: string) => void }) {
  const [form, setForm] = useState({ brandName: "", companyName: "", category: "", website: "", email: "", phone: "", whatsapp: "", country: "", city: "", instagramUsername: "", facebookUrl: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setErrors({});
    try {
      const res = await api<{ client: { cid: string } }>("/api/clients", { body: form });
      onCreated(res.client.cid);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fieldErrors());
        setError(err.message);
      } else setError("Could not create the client");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onClose={onClose} title="New client" description="Add a prospect manually. A CID is assigned automatically." size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" form="create-client" loading={loading}>Create client</Button></>}>
      <form id="create-client" onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <Field label="Brand name" error={errors.brandName} className="sm:col-span-2"><Input value={form.brandName} onChange={set("brandName")} required /></Field>
        <Field label="Company name"><Input value={form.companyName} onChange={set("companyName")} /></Field>
        <Field label="Category"><Input value={form.category} onChange={set("category")} placeholder="Streetwear brand" /></Field>
        <Field label="Instagram username" error={errors.instagramUsername}><Input value={form.instagramUsername} onChange={set("instagramUsername")} placeholder="@brand" /></Field>
        <Field label="Facebook page URL" error={errors.facebookUrl}><Input value={form.facebookUrl} onChange={set("facebookUrl")} placeholder="https://facebook.com/brand" /></Field>
        <Field label="Website" error={errors.website}><Input value={form.website} onChange={set("website")} /></Field>
        <Field label="Email" error={errors.email}><Input value={form.email} onChange={set("email")} /></Field>
        <Field label="Phone"><Input value={form.phone} onChange={set("phone")} /></Field>
        <Field label="WhatsApp"><Input value={form.whatsapp} onChange={set("whatsapp")} /></Field>
        <Field label="Country"><Input value={form.country} onChange={set("country")} /></Field>
        <Field label="City"><Input value={form.city} onChange={set("city")} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={set("notes")} className="min-h-[70px]" /></Field>
        {error && <p className="sm:col-span-2 text-[13px] text-red-600">{error}</p>}
      </form>
    </Dialog>
  );
}
