import type { Metadata } from "next";
import { Eyebrow, Headline, Marker, PosterCard, Section } from "@/components/site/blocks";

export const metadata: Metadata = { title: "Contact", description: "Talk to the CNEX AI team about OSES J." };

export default function ContactPage() {
  return (
    <Section className="grid gap-10 lg:grid-cols-[1fr_1fr]">
      <div>
        <Eyebrow tone="blue">Contact</Eyebrow>
        <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">Talk to us</Headline>
        <p className="mt-6 text-[15px] leading-relaxed text-muted">Questions about onboarding, providers, the extension or a workspace for your team: write to us and a human replies, usually within one business day.</p>
        <Marker className="mt-6 block text-[20px]">we read everything</Marker>
      </div>
      <div className="grid gap-4">
        <PosterCard>
          <h3 className="font-display text-[14px] uppercase">Email</h3>
          <a href="mailto:hello@cnexai.com" className="mt-2 block text-[15px] font-bold underline decoration-2 underline-offset-4">
            hello@cnexai.com
          </a>
          <p className="mt-2 text-[13px] text-muted">Sales, onboarding and partnership enquiries.</p>
        </PosterCard>
        <PosterCard tape={false}>
          <h3 className="font-display text-[14px] uppercase">Support</h3>
          <a href="mailto:support@cnexai.com" className="mt-2 block text-[15px] font-bold underline decoration-2 underline-offset-4">
            support@cnexai.com
          </a>
          <p className="mt-2 text-[13px] text-muted">Include your workspace name and, if relevant, the client CID or search run.</p>
        </PosterCard>
        <PosterCard tape={false}>
          <h3 className="font-display text-[14px] uppercase">Company</h3>
          <p className="mt-2 text-[13px] text-muted">CNEX AI · OSES J is a product of CNEX AI.</p>
        </PosterCard>
      </div>
    </Section>
  );
}
