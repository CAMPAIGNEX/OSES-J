"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Bookmark, Download, Search, SlidersHorizontal } from "@/components/ui/icons";
import { api, qs } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { PageHeader } from "@/components/layout/app-shell";
import { Button, Card, EmptyState, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";
import { LeadsTable, type LeadPage } from "./leads-table";

export function SavedLeads() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [filters, setFilters] = useState({
    q: params.get("q") ?? "",
    platform: params.get("platform") ?? "",
    country: params.get("country") ?? "",
    city: params.get("city") ?? "",
    minFollowers: params.get("minFollowers") ?? "",
    maxFollowers: params.get("maxFollowers") ?? "",
    hasEmail: params.get("hasEmail") === "true",
    hasPhone: params.get("hasPhone") === "true",
    hasWebsite: params.get("hasWebsite") === "true",
    saved: params.get("saved") ?? "true",
    added: params.get("added") ?? "",
    sort: params.get("sort") ?? "score",
    tag: params.get("tag") ?? "",
  });
  const [applied, setApplied] = useState(filters);
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setApplied(filters), 350);
    return () => clearTimeout(t);
  }, [filters]);
  useEffect(() => setPage(1), [applied]);

  const query = qs({
    page,
    pageSize: 50,
    q: applied.q,
    platform: applied.platform,
    country: applied.country,
    city: applied.city,
    minFollowers: applied.minFollowers,
    maxFollowers: applied.maxFollowers,
    hasEmail: applied.hasEmail ? "true" : "",
    hasPhone: applied.hasPhone ? "true" : "",
    hasWebsite: applied.hasWebsite ? "true" : "",
    saved: applied.saved === "" ? "" : applied.saved,
    added: applied.added,
    sort: applied.sort,
    tag: applied.tag,
  });
  const leads = useQuery<LeadPage>(`/api/leads${query}`);
  const set = <K extends keyof typeof filters>(k: K, v: (typeof filters)[K]) => setFilters((f) => ({ ...f, [k]: v }));

  async function exportFiltered() {
    setExporting(true);
    try {
      const blob = await api<Blob>("/api/leads/export", { body: { scope: "filtered", filters: { q: applied.q || undefined, platform: applied.platform || undefined, country: applied.country || undefined, city: applied.city || undefined, saved: applied.saved === "" ? undefined : applied.saved === "true", hasEmail: applied.hasEmail || undefined, hasPhone: applied.hasPhone || undefined, hasWebsite: applied.hasWebsite || undefined, tag: applied.tag || undefined } } });
      if (blob instanceof Blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } else toast.info("Export queued", "Large exports are prepared in the background and appear in Documents.");
    } catch (err) {
      toast.error("Export failed", err instanceof Error ? err.message : undefined);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="animate-in">
      <PageHeader
        title={applied.saved === "true" ? "Saved Leads" : "All Leads"}
        description="Everything you discovered, de-duplicated. Select leads to add them to your clients or export them."
        actions={
          <>
            <Button variant="outline" onClick={() => void exportFiltered()} loading={exporting} icon={<Download className="h-4 w-4" />}>
              Export all filtered
            </Button>
            <Button onClick={() => router.push("/leads/search")} icon={<Search className="h-4 w-4" />}>
              Search leads
            </Button>
          </>
        }
      />
      <Card className="mb-4" padded={false}>
        <div className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
            <Input value={filters.q} onChange={(e) => set("q", e.target.value)} placeholder="Search brand, username, bio, email…" className="pl-9" />
          </div>
          <Select value={filters.saved} onChange={(e) => set("saved", e.target.value)} className="w-40">
            <option value="true">Saved only</option>
            <option value="">All discovered</option>
            <option value="false">Not saved</option>
          </Select>
          <Select value={filters.platform} onChange={(e) => set("platform", e.target.value)} className="w-36">
            <option value="">All platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
          </Select>
          <Select value={filters.sort} onChange={(e) => set("sort", e.target.value)} className="w-40">
            <option value="score">Best score</option>
            <option value="followers">Most followers</option>
            <option value="newest">Newest</option>
            <option value="name">Name</option>
          </Select>
          <Button variant="outline" onClick={() => setShowFilters((s) => !s)} icon={<SlidersHorizontal className="h-4 w-4" />}>
            Filters
          </Button>
        </div>
        {showFilters && (
          <div className="grid gap-3 border-t border-default p-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input value={filters.country} onChange={(e) => set("country", e.target.value)} placeholder="Country" />
            <Input value={filters.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
            <Input inputMode="numeric" value={filters.minFollowers} onChange={(e) => set("minFollowers", e.target.value.replace(/[^\d]/g, ""))} placeholder="Min followers" />
            <Input inputMode="numeric" value={filters.maxFollowers} onChange={(e) => set("maxFollowers", e.target.value.replace(/[^\d]/g, ""))} placeholder="Max followers" />
            <Input value={filters.tag} onChange={(e) => set("tag", e.target.value)} placeholder="Tag" />
            <Select value={filters.added} onChange={(e) => set("added", e.target.value)}>
              <option value="">Client status: any</option>
              <option value="true">Already a client</option>
              <option value="false">Not yet a client</option>
            </Select>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand-500" checked={filters.hasEmail} onChange={(e) => set("hasEmail", e.target.checked)} /> Has email</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand-500" checked={filters.hasPhone} onChange={(e) => set("hasPhone", e.target.checked)} /> Has phone</label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="accent-brand-500" checked={filters.hasWebsite} onChange={(e) => set("hasWebsite", e.target.checked)} /> Has website</label>
          </div>
        )}
      </Card>
      <LeadsTable
        data={leads.data}
        loading={leads.loading}
        onChanged={() => void leads.refetch()}
        onPage={setPage}
        emptyMessage={<EmptyState icon={<Bookmark className="h-5 w-5" />} title={applied.saved === "true" ? "No saved leads yet" : "No leads match these filters"} description="Run a search and click Save on the leads you want to keep." action={<Button href="/leads/search" size="sm">Search leads</Button>} />}
      />
    </div>
  );
}
