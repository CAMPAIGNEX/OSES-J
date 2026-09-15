"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpen, ChevronRight, Info, X } from "@/components/ui/icons";
import { GUIDES } from "@/content/guides";
import { cn } from "@/lib/cn";

/**
 * "How to use this" box at the top of a feature page: a few plain steps plus a link to the manual.
 * Users can collapse it; the choice is remembered per guide on the device. Never hides anything
 * the user needs to act on, so it is safe to dismiss.
 */
export function FeatureGuide({ id, className }: { id: keyof typeof GUIDES; className?: string }) {
  const guide = GUIDES[id];
  const storageKey = `oses-guide-${id}`;
  const [open, setOpen] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(storageKey) !== "collapsed");
    } catch {
      /* storage unavailable: stay open */
    }
    setReady(true);
  }, [storageKey]);

  function toggle(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(storageKey, next ? "open" : "collapsed");
    } catch {
      /* ignore */
    }
  }

  if (!guide || !ready) return null;
  if (!open) {
    return (
      <button type="button" onClick={() => toggle(true)} data-ui="guide-toggle" className={cn("mb-4 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-default bg-surface px-3 text-[12px] text-muted hover:text-body", className)}>
        <Info className="h-3.5 w-3.5 text-brand-500" />
        {guide.title}
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    );
  }
  return (
    <section data-ui="guide" aria-label={guide.title} className={cn("mb-5 rounded-xl border border-brand-200/70 bg-brand-50/60 px-4 py-3 text-[13px] dark:border-brand-900/60 dark:bg-brand-900/20", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-semibold">
            <Info className="h-4 w-4 text-brand-500" />
            {guide.title}
          </p>
          <ol className="mt-2 space-y-1.5 text-muted">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-[1px] inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-[10px] font-semibold text-brand-600 dark:text-brand-300">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <Link href={`/docs/${guide.docs}`} target="_blank" className="mt-2 inline-flex min-h-[32px] items-center gap-1.5 text-[12px] font-medium text-brand-600 hover:underline dark:text-brand-300">
            <BookOpen className="h-3.5 w-3.5" />
            Open the manual
          </Link>
        </div>
        <button type="button" onClick={() => toggle(false)} aria-label="Hide instructions" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-faint hover:bg-surface-2 hover:text-body">
          <X className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}
