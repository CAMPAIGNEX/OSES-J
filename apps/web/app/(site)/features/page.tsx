import type { Metadata } from "next";
import { CtaBand, Eyebrow, FeatureCard, Headline, Marker, Section } from "@/components/site/blocks";
import { FEATURES } from "@/content/features";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "Features", description: "Everything inside OSES-J: lead search, enrichment, CRM, unified inbox, AI sales agent, campaigns, analysis, integrations and security." };

export default async function FeaturesPage() {
  const signedIn = Boolean(await getSession());
  return (
    <>
      <Section className="pb-6">
        <Eyebrow>Features</Eyebrow>
        <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">Everything an export sales desk needs</Headline>
        <p className="mt-4 max-w-2xl text-[15px] text-muted">Each feature has its own page with what it does, how to use it and a link to the manual. The manual is updated whenever a feature changes.</p>
        <Marker className="mt-4 block">click a card for the full story</Marker>
      </Section>
      <Section className="pt-4">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.slug} feature={f} />
          ))}
        </div>
      </Section>
      <CtaBand signedIn={signedIn} />
    </>
  );
}
