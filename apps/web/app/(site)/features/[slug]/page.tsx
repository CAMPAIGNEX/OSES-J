import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACCENT_BG, CtaBand, Eyebrow, FeatureIcon, Headline, Marker, PosterCard, Section } from "@/components/site/blocks";
import { FEATURES, getFeature } from "@/content/features";
import { getSession } from "@/lib/server/session";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const feature = getFeature((await params).slug);
  return feature ? { title: feature.name, description: feature.description } : {};
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const feature = getFeature((await params).slug);
  if (!feature) notFound();
  const signedIn = Boolean(await getSession());
  const index = FEATURES.findIndex((f) => f.slug === feature.slug);
  const next = FEATURES[(index + 1) % FEATURES.length] ?? feature;
  return (
    <>
      <Section className="grid gap-10 pb-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Link href="/features" className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted hover:text-body">
            ← All features
          </Link>
          <div className="mt-6 flex items-center gap-4">
            <span className={`flex h-14 w-14 items-center justify-center border-2 border-ink shadow-[4px_4px_0_0_var(--ink)] ${ACCENT_BG[feature.accent]}`}>
              <FeatureIcon icon={feature.icon} className="h-7 w-7" />
            </span>
            <Eyebrow tone="blue">Feature</Eyebrow>
          </div>
          <Headline as="h1" className="mt-6 text-4xl sm:text-6xl">{feature.name}</Headline>
          <Marker className="mt-3 block text-[22px]">{feature.tagline}</Marker>
          <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-muted">{feature.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/docs/${feature.doc}`} data-ui="button" data-variant="primary" className="inline-flex h-11 items-center px-5 text-[12px]">
              Read the manual
            </Link>
            <Link href={signedIn ? "/dashboard" : "/register"} data-ui="button" data-variant="outline" className="inline-flex h-11 items-center px-5 text-[12px]">
              {signedIn ? "Open the app" : "Try it"}
            </Link>
          </div>
        </div>
        <PosterCard>
          <h2 className="font-display text-[14px] uppercase tracking-[0.06em]">Highlights</h2>
          <ul className="mt-4 space-y-3">
            {feature.highlights.map((h) => (
              <li key={h} className="flex gap-3 text-[13px] leading-relaxed">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 bg-bauhaus-red" aria-hidden />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </PosterCard>
      </Section>
      <Section className="pt-4">
        <Eyebrow tone="yellow">How to use it</Eyebrow>
        <ol className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {feature.steps.map((s, i) => (
            <li key={s} className="border-2 border-ink bg-surface p-5 shadow-[4px_4px_0_0_var(--ink)]">
              <span className="poster-number text-3xl">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-3 text-[13px] leading-relaxed">{s}</p>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-[13px] text-muted">
          Next feature:{" "}
          <Link href={`/features/${next.slug}`} className="font-bold underline decoration-2 underline-offset-4">
            {next.name} →
          </Link>
        </p>
      </Section>
      <CtaBand signedIn={signedIn} />
    </>
  );
}
