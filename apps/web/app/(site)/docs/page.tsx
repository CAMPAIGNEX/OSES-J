import type { Metadata } from "next";
import Link from "next/link";
import { Eyebrow, Headline, Marker } from "@/components/site/blocks";
import { DocsShell } from "@/components/site/docs-shell";
import { DOC_SECTIONS, listDocs } from "@/lib/content";

export const metadata: Metadata = { title: "Manual", description: "The OSES-J user manual: every feature explained step by step, kept up to date with the product." };

export default function DocsIndexPage() {
  const docs = listDocs();
  const latest = [...docs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return (
    <DocsShell docs={docs}>
      <Eyebrow tone="blue">User manual</Eyebrow>
      <Headline as="h1" className="mt-4 text-4xl sm:text-5xl">Every feature, explained</Headline>
      <p className="mt-4 max-w-2xl text-[15px] text-muted">The manual lives next to the code and is updated whenever a feature is added or changed. Each page shows its last update date.</p>
      {latest && <Marker className="mt-3 block">last updated {new Date(latest.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</Marker>}
      <div className="mt-10 space-y-10">
        {DOC_SECTIONS.map((section) => {
          const items = docs.filter((d) => d.section === section);
          if (!items.length) return null;
          return (
            <section key={section}>
              <h2 className="font-display text-[14px] uppercase tracking-[0.12em]">{section}</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {items.map((d) => (
                  <li key={d.slug}>
                    <Link href={`/docs/${d.slug}`} className="block h-full border-2 border-ink bg-surface p-4 shadow-[3px_3px_0_0_var(--ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5">
                      <p className="text-[14px] font-bold">{d.title}</p>
                      {d.summary && <p className="mt-1 text-[13px] text-muted">{d.summary}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </DocsShell>
  );
}
