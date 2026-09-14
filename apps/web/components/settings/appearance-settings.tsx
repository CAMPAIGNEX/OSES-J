"use client";

import { useEffect, useState } from "react";
import { Check, Moon, Sun } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { useQuery } from "@/lib/hooks/use-query";
import { normalizeTemplate, TEMPLATE_COOKIE, UI_TEMPLATES, type UiTemplate } from "@/lib/templates";
import { Button, Card, CardHeader, Skeleton, cn } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/overlay";

/** Miniature of the app shell rendered inside the template's own token scope. */
function TemplatePreview({ id }: { id: UiTemplate }) {
  return (
    <div data-template={id} className="bg-app pointer-events-none select-none overflow-hidden rounded-[10px] border border-default" aria-hidden>
      <div className="flex h-[132px]">
        <div data-ui="sidebar" className="flex w-[42%] flex-col gap-1.5 border-r border-default bg-surface p-2">
          <div className="flex items-center gap-1.5">
            <span data-ui="brand-mark" className="h-4 w-4 rounded-md bg-brand-500" />
            <span className="h-1.5 w-10 rounded bg-brand-500/80" />
          </div>
          <span data-ui="nav-link" aria-current="page" className="nav-active mt-1 block h-4 w-full rounded-md px-1 text-[7px] font-semibold leading-4">
            Dashboard
          </span>
          <span className="block h-3 w-4/5 rounded bg-surface-2" />
          <span className="block h-3 w-3/5 rounded bg-surface-2" />
          <span className="block h-3 w-4/5 rounded bg-surface-2" />
        </div>
        <div className="flex-1 space-y-2 p-2">
          <div className="flex items-center justify-between">
            <span className="font-display text-[9px] font-bold uppercase text-body">Leads</span>
            <span data-ui="button" data-variant="primary" className="rounded-md bg-brand-500 px-1.5 py-0.5 text-[6px] font-semibold text-white">
              New search
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div data-ui="stat" className="card p-1.5">
              <span className="block text-[6px] uppercase text-faint">Saved</span>
              <span data-ui="stat-value" className="block text-[11px] font-bold text-body">128</span>
            </div>
            <div data-ui="stat" className="card p-1.5">
              <span className="block text-[6px] uppercase text-faint">Replies</span>
              <span data-ui="stat-value" className="block text-[11px] font-bold text-body">37</span>
            </div>
          </div>
          <div data-ui="card" className="card p-1.5">
            <div className="flex items-center gap-1">
              <span data-ui="badge" data-tone="success" className="rounded-full border px-1 text-[6px] leading-3">
                Interested
              </span>
              <span data-ui="badge" data-tone="warning" className="rounded-full border px-1 text-[6px] leading-3">
                Follow-up
              </span>
            </div>
            <span className="mt-1 block h-1.5 w-full rounded bg-surface-2" />
            <span className="mt-1 block h-1.5 w-2/3 rounded bg-surface-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceSettings() {
  const toast = useToast();
  const { data, loading, refetch } = useQuery<{ template: string }>("/api/settings/appearance");
  const [current, setCurrent] = useState<UiTemplate>("classic");
  const [saving, setSaving] = useState<UiTemplate | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (data) setCurrent(normalizeTemplate(data.template));
  }, [data]);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);

  function applyLocally(template: UiTemplate) {
    document.documentElement.dataset.template = template;
    document.cookie = `${TEMPLATE_COOKIE}=${template}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  async function choose(template: UiTemplate) {
    if (template === current) return;
    setSaving(template);
    const previous = current;
    setCurrent(template);
    applyLocally(template);
    try {
      await api("/api/settings/appearance", { method: "PUT", body: { template } });
      toast.success(`${UI_TEMPLATES.find((t) => t.id === template)?.name} applied for the whole workspace`);
      await refetch();
    } catch (err) {
      setCurrent(previous);
      applyLocally(previous);
      toast.error("Could not apply the template", err instanceof Error ? err.message : undefined);
    } finally {
      setSaving(null);
    }
  }

  function toggleMode() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("oses-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <Card>
        <CardHeader title="Template" description="Templates restyle the entire workspace: colours, type, icons, boxes and textures. The choice applies to everyone in this workspace." />
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {UI_TEMPLATES.map((t) => {
              const active = current === t.id;
              return (
                <button key={t.id} type="button" onClick={() => void choose(t.id)} disabled={saving !== null} className={cn("group rounded-xl border-2 p-3 text-left transition-colors", active ? "border-brand-500 bg-brand-50/40 dark:bg-brand-900/20" : "border-default hover:border-strong")} aria-pressed={active}>
                  <TemplatePreview id={t.id} />
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-body">{t.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{t.description}</p>
                    </div>
                    <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", active ? "border-brand-500 bg-brand-500 text-white" : "border-strong text-transparent")} aria-hidden>
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  {saving === t.id && <p className="mt-2 text-[12px] text-muted">Applying…</p>}
                </button>
              );
            })}
          </div>
        )}
      </Card>
      <Card>
        <CardHeader title="Light / dark" description="Personal preference for this device. Both templates have a light and a dark variant." />
        <Button variant="outline" icon={dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} onClick={toggleMode}>
          Switch to {dark ? "light" : "dark"} mode
        </Button>
      </Card>
      <Card>
        <CardHeader title="What Bauhaus Mix changes" />
        <ul className="grid gap-2 text-[13px] text-muted sm:grid-cols-2">
          <li>
            <span className="font-medium text-body">Geometry</span> — primary shapes, zero corner radius, 2px ink borders and hard offset shadows.
          </li>
          <li>
            <span className="font-medium text-body">Colour</span> — paper and ink with Bauhaus red, blue and yellow blocks, pop pink and spray green accents.
          </li>
          <li>
            <span className="font-medium text-body">Type</span> — Archivo Black poster headings, Space Grotesk body text, marker-style badges.
          </li>
          <li>
            <span className="font-medium text-body">Texture</span> — paper grain, halftone dots, tape strips on cards and stencil empty states.
          </li>
        </ul>
      </Card>
    </>
  );
}
