import type { Metadata } from "next";
import { CtaBand, Eyebrow, Headline, Marker, PosterCard, Section } from "@/components/site/blocks";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "About", description: "OSES J is built by CNEX AI for apparel and sportswear exporters." };

export default async function AboutPage() {
  const signedIn = Boolean(await getSession());
  return (
    <>
      <Section className="grid gap-10 lg:grid-cols-[1fr_1fr]">
        <div>
          <Eyebrow>About</Eyebrow>
          <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">Built for exporters, by CNEX AI</Headline>
          <p className="mt-6 text-[15px] leading-relaxed text-muted">OSES J started with a simple observation: apparel, sportswear and fitness-wear manufacturers win business by finding the right brands early and talking to them properly. Most of that work happens on Instagram and Facebook, and most of it is manual, repetitive and easy to get wrong.</p>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">We built a system that does the finding, organising and first drafts, while keeping people in charge of every promise made to a buyer. No invented prices. No guessed certifications. Sources on every field.</p>
          <Marker className="mt-6 block text-[20px]">honest data, bold design</Marker>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Sialkot roots", "Designed with exporters from the sportswear capital, for teams of one to fifty."],
            ["Provider-neutral", "Apify, Meta, AI models and the browser extension all sit behind interfaces you can swap."],
            ["Human in control", "Manual, Copilot and Autopilot modes with approvals, limits, escalation and an emergency stop."],
            ["Design that stands out", "A Bauhaus, graffiti, mixed-media and pop-art template, because export sales does not have to look like a spreadsheet."],
          ].map(([t, d]) => (
            <PosterCard key={t} tape={false}>
              <h3 className="font-display text-[14px] uppercase">{t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{d}</p>
            </PosterCard>
          ))}
        </div>
      </Section>
      <CtaBand signedIn={signedIn} />
    </>
  );
}
