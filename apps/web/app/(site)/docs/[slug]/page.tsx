import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Eyebrow } from "@/components/site/blocks";
import { DocsShell } from "@/components/site/docs-shell";
import { getDoc, listDocs } from "@/lib/content";

export function generateStaticParams() {
  return listDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getDoc((await params).slug);
  return doc ? { title: `${doc.title} · Manual`, description: doc.summary } : {};
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug);
  if (!doc) notFound();
  const docs = listDocs();
  const index = docs.findIndex((d) => d.slug === slug);
  const prev = index > 0 ? docs[index - 1] : null;
  const next = index >= 0 && index < docs.length - 1 ? docs[index + 1] : null;
  return (
    <DocsShell docs={docs} current={slug}>
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_200px]">
        <article>
          <Eyebrow tone="blue">{doc.section}</Eyebrow>
          <h1 className="mt-4 font-display text-3xl uppercase leading-tight sm:text-5xl">{doc.title}</h1>
          {doc.summary && <p className="mt-3 text-[15px] text-muted">{doc.summary}</p>}
          <p className="mt-2 text-[12px] uppercase tracking-[0.1em] text-faint">Updated {new Date(doc.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
          <div className="prose-doc mt-8" dangerouslySetInnerHTML={{ __html: doc.html }} />
          <nav className="mt-12 flex flex-wrap justify-between gap-3 border-t-2 border-ink pt-6 text-[13px]" aria-label="Manual pagination">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="font-bold underline decoration-2 underline-offset-4">
                ← {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/docs/${next.slug}`} className="font-bold underline decoration-2 underline-offset-4">
                {next.title} →
              </Link>
            )}
          </nav>
        </article>
        {doc.headings.length > 0 && (
          <aside className="hidden xl:block xl:sticky xl:top-6 xl:self-start">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">On this page</p>
            <ul className="mt-2 space-y-1 border-l-2 border-ink pl-3 text-[12px]">
              {doc.headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
                  <a href={`#${h.id}`} className="text-muted hover:text-body">
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </DocsShell>
  );
}
