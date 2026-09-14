import type { Metadata } from "next";
import { Eyebrow, Headline, Section } from "@/components/site/blocks";
import { renderMarkdownFile } from "@/lib/content";

export const metadata: Metadata = { title: "Changelog", description: "What changed in OSES-J, release by release." };

export default function ChangelogPage() {
  const { html, updatedAt } = renderMarkdownFile("changelog.md");
  return (
    <Section>
      <Eyebrow tone="yellow">Changelog</Eyebrow>
      <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">What changed</Headline>
      <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-faint">Updated {new Date(updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
      <div className="prose-doc mt-8 max-w-3xl" dangerouslySetInnerHTML={{ __html: html }} />
    </Section>
  );
}
