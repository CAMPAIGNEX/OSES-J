import Link from "next/link";
import type { ReactNode } from "react";
import { DOC_SECTIONS, type DocMeta } from "@/lib/content";
import { cn } from "@/lib/cn";

export function DocsShell({ docs, current, children }: { docs: DocMeta[]; current?: string; children: ReactNode }) {
  const grouped = DOC_SECTIONS.map((section) => ({ section, items: docs.filter((d) => d.section === section) })).filter((g) => g.items.length);
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <Link href="/docs" className="font-display text-[12px] uppercase tracking-[0.16em]">
          Manual
        </Link>
        <nav className="mt-4 space-y-5" aria-label="Manual">
          {grouped.map((g) => (
            <div key={g.section}>
              <p className="border-b-2 border-ink pb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{g.section}</p>
              <ul className="mt-2 space-y-0.5">
                {g.items.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/docs/${d.slug}`} className={cn("block px-2 py-1.5 text-[13px]", current === d.slug ? "bg-bauhaus-yellow font-semibold text-ink" : "hover:bg-surface-2")} aria-current={current === d.slug ? "page" : undefined}>
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
