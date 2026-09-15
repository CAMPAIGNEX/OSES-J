"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Search, Sparkles, Bookmark, History, Trash2, AlertTriangle } from "@/components/ui/icons";
import { api, ApiError } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, CardHeader, Field, Input, Select, StatusBadge, Switch, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

interface SavedSearch {
  id: string;
  name: string;
  criteria: Record<string, unknown>;
  lastRunAt: string | null;
  runCount: number;
}
interface RunSummary {
  id: string;
  query: string;
  status: string;
  totalNew: number;
  totalDeduped: number;
  createdAt: string;
  criteria: { platforms?: string[]; limit?: number };
}

const COUNTS = [10, 20, 30, 50, 100];

export function SearchForm() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ query: "", platform: "INSTAGRAM", minFollowers: "", maxFollowers: "", country: "", region: "", city: "", limit: 20, customLimit: "", strategy: "auto", hasWebsite: false, hasEmail: false, businessOnly: false, enrich: true });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const saved = useQuery<{ items: SavedSearch[] }>("/api/leads/saved-searches");
  const runs = useQuery<{ items: RunSummary[] }>("/api/leads/search?take=8", { refreshInterval: 15_000 });
  const status = useQuery<{ apify: { configured: boolean; providerConfigs: number } }>("/api/automation/status");

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  function buildPayload() {
    const limit = form.customLimit ? Number(form.customLimit) : form.limit;
    return {
      query: form.query,
      platform: form.platform,
      minFollowers: form.minFollowers ? Number(form.minFollowers) : null,
      maxFollowers: form.maxFollowers ? Number(form.maxFollowers) : null,
      country: form.country || null,
      region: form.region || null,
      city: form.city || null,
      limit,
      strategy: form.strategy,
      filters: { hasWebsite: form.hasWebsite || undefined, hasEmail: form.hasEmail || undefined, businessOnly: form.businessOnly || undefined },
      enrich: form.enrich,
    };
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFields({});
    try {
      const res = await api<{ searchRunId: string; warnings: string[]; providersConfigured: number }>("/api/leads/search", { body: buildPayload() });
      if (res.providersConfigured === 0) toast.warning("Lead discovery is not active yet", res.warnings[0] ?? "Contact CNEX AI (info@cnexai.com) to activate it for your workspace.");
      router.push(`/leads/search/${res.searchRunId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fieldErrors());
        setError(err.message);
      } else setError("Search could not be started.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveSearch() {
    if (!form.query.trim()) return setError("Enter a query before saving the search.");
    const name = window.prompt("Name this saved search", form.query.slice(0, 60));
    if (!name) return;
    try {
      await api("/api/leads/saved-searches", { body: { name, criteria: buildPayload() } });
      toast.success("Search saved");
      void saved.refetch();
    } catch (err) {
      toast.error("Could not save search", err instanceof Error ? err.message : undefined);
    }
  }

  function loadSaved(s: SavedSearch) {
    const c = s.criteria as Record<string, unknown>;
    const filters = (c.filters as Record<string, boolean> | undefined) ?? {};
    setForm({
      query: String(c.query ?? ""),
      platform: String(c.platform ?? "INSTAGRAM"),
      minFollowers: c.minFollowers ? String(c.minFollowers) : "",
      maxFollowers: c.maxFollowers ? String(c.maxFollowers) : "",
      country: String(c.country ?? ""),
      region: String(c.region ?? ""),
      city: String(c.city ?? ""),
      limit: COUNTS.includes(Number(c.limit)) ? Number(c.limit) : 20,
      customLimit: COUNTS.includes(Number(c.limit)) ? "" : String(c.limit ?? ""),
      strategy: String(c.strategy ?? "auto"),
      hasWebsite: Boolean(filters.hasWebsite),
      hasEmail: Boolean(filters.hasEmail),
      businessOnly: Boolean(filters.businessOnly),
      enrich: c.enrich !== false,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function runSaved(s: SavedSearch) {
    try {
      const res = await api<{ searchRunId: string }>("/api/leads/search", { body: { ...(s.criteria as object), savedSearchId: s.id } });
      router.push(`/leads/search/${res.searchRunId}`);
    } catch (err) {
      toast.error("Could not run search", err instanceof Error ? err.message : undefined);
    }
  }

  async function deleteSaved(s: SavedSearch) {
    await api(`/api/leads/saved-searches/${s.id}`, { method: "DELETE" });
    void saved.refetch();
  }

  const apifyMissing = status.data && !status.data.apify.configured;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {apifyMissing && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Lead discovery is not active yet</p>
              <p>The CNEX AI team activates discovery for your workspace; check <a href="/settings/automation" className="underline">Settings → Automation → Services</a> or email <a href="mailto:info@cnexai.com" className="underline">info@cnexai.com</a> (WhatsApp +92 312 7233047).</p>
            </div>
          </div>
        )}
        <Card>
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <label className="mb-1.5 block text-[13px] font-medium">What are you looking for?</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <Input value={form.query} onChange={(e) => set("query", e.target.value)} placeholder='e.g. "New apparel brands in New York" or "streetwear brands in London"' className="h-11 pl-9 text-[15px]" invalid={Boolean(fields.query)} autoFocus />
              </div>
              {fields.query ? <p className="mt-1 text-xs text-red-600">{fields.query}</p> : <p className="mt-1 text-xs text-faint">Keywords and location are parsed automatically; the fields below refine them.</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Platform">
                <Select value={form.platform} onChange={(e) => set("platform", e.target.value)}>
                  <option value="INSTAGRAM">Instagram</option>
                  <option value="FACEBOOK">Facebook</option>
                  <option value="BOTH">Both</option>
                </Select>
              </Field>
              <Field label="Min followers" error={fields.minFollowers}>
                <Input inputMode="numeric" value={form.minFollowers} onChange={(e) => set("minFollowers", e.target.value.replace(/[^\d]/g, ""))} placeholder="5,000" />
              </Field>
              <Field label="Max followers" error={fields.maxFollowers}>
                <Input inputMode="numeric" value={form.maxFollowers} onChange={(e) => set("maxFollowers", e.target.value.replace(/[^\d]/g, ""))} placeholder="100,000" />
              </Field>
              <Field label="Results">
                <div className="flex gap-2">
                  <Select value={form.customLimit ? "custom" : String(form.limit)} onChange={(e) => (e.target.value === "custom" ? set("customLimit", "25") : (set("limit", Number(e.target.value)), set("customLimit", "")))} className="flex-1">
                    {COUNTS.map((c) => (
                      <option key={c} value={c}>
                        {c} leads
                      </option>
                    ))}
                    <option value="custom">Custom…</option>
                  </Select>
                  {form.customLimit !== "" && <Input inputMode="numeric" value={form.customLimit} onChange={(e) => set("customLimit", e.target.value.replace(/[^\d]/g, ""))} className="w-20" aria-label="Custom count" />}
                </div>
              </Field>
              <Field label="Country">
                <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="United States" />
              </Field>
              <Field label="State / region">
                <Input value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="NY" />
              </Field>
              <Field label="City">
                <Input value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="New York" />
              </Field>
              <Field label="Strategy" hint="advanced">
                <Select value={form.strategy} onChange={(e) => set("strategy", e.target.value)}>
                  <option value="auto">Auto (recommended)</option>
                  <option value="search_engine">Search engine (site:instagram.com)</option>
                  <option value="profile_search">Platform profile search</option>
                  <option value="hashtag">Hashtag posts</option>
                </Select>
              </Field>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-default pt-4">
              <Switch checked={form.hasWebsite} onChange={(v) => set("hasWebsite", v)} label="Website available" />
              <Switch checked={form.hasEmail} onChange={(v) => set("hasEmail", v)} label="Email available" />
              <Switch checked={form.businessOnly} onChange={(v) => set("businessOnly", v)} label="Business accounts only" />
              <Switch checked={form.enrich} onChange={(v) => set("enrich", v)} label="Enrich profiles & websites" description="Fetch bio, followers and contact details after discovery" />
            </div>
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-faint">Results are normalized, de-duplicated against your existing leads and scored before they appear.</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => void saveSearch()} icon={<Bookmark className="h-4 w-4" />}>
                  Save search
                </Button>
                <Button type="submit" size="lg" loading={submitting} icon={<Sparkles className="h-4 w-4" />}>
                  Find leads
                </Button>
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Recent searches" description="Re-open results or check progress." />
          {runs.data?.items.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {runs.data.items.map((r) => (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <History className="h-4 w-4 shrink-0 text-faint" />
                  <a href={`/leads/search/${r.id}`} className="min-w-0 flex-1 hover:underline">
                    <span className="block truncate text-[13px] font-medium">{r.query}</span>
                    <span className="block text-xs text-faint">
                      {formatDateTime(r.createdAt)} · {(r.criteria?.platforms ?? []).map((p) => p.toLowerCase()).join(", ")} · {r.totalDeduped} results ({r.totalNew} new)
                    </span>
                  </a>
                  <StatusBadge status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">{runs.loading ? "Loading…" : "No searches yet."}</p>
          )}
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Saved searches" />
          {saved.data?.items.length ? (
            <ul className="space-y-2">
              {saved.data.items.map((s) => (
                <li key={s.id} className={cn("rounded-lg border border-default p-3")}>
                  <p className="text-[13px] font-medium">{s.name}</p>
                  <p className="mt-0.5 text-xs text-faint">{String((s.criteria as { query?: string }).query ?? "")}</p>
                  <div className="mt-2 flex items-center gap-1">
                    <Button size="xs" onClick={() => void runSaved(s)}>
                      Run search
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => loadSaved(s)}>
                      Edit
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => void deleteSaved(s)} aria-label="Delete saved search">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {s.runCount > 0 && <Badge className="ml-auto">{s.runCount} runs</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted">Save a search configuration to run it again with one click.</p>
          )}
        </Card>
        <Card className="bg-brand-50/60 dark:bg-brand-900/20">
          <h3 className="text-[13px] font-semibold">Tips for better results</h3>
          <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
            <li>• Combine a product word with a place: “gym wear brands in Manchester”.</li>
            <li>• Use follower ranges to target brands that outsource production (5K–250K works well).</li>
            <li>• Enrichment adds emails and phones from bios and websites, labelled with their source.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
