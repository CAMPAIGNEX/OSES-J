import type { Metadata } from "next";
import { Eyebrow, Headline, Section } from "@/components/site/blocks";

export const metadata: Metadata = { title: "Terms of service", description: "The terms under which CNEX AI provides OSES-J." };

export default function TermsPage() {
  return (
    <Section>
      <Eyebrow tone="blue">Legal</Eyebrow>
      <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">Terms of service</Headline>
      <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-faint">Effective 14 September 2026</p>
      <div className="prose-doc mt-8 max-w-3xl">
        <h2>The service</h2>
        <p>OSES-J ("the service") is provided by CNEX AI to organisations ("you") for finding, organising and contacting business prospects on social platforms. Access is through workspaces created by you.</p>
        <h2>Your responsibilities</h2>
        <ul>
          <li>Use the service in compliance with the laws that apply to your outreach and with the terms of the platforms and providers you connect (Instagram, Facebook, Apify, AI providers).</li>
          <li>Keep your company facts accurate. The AI relies on them; you are responsible for what is sent from your workspace.</li>
          <li>Honour opt-out and do-not-contact requests. The service enforces them once recorded.</li>
          <li>Keep your credentials confidential and manage team access through roles.</li>
        </ul>
        <h2>Providers and costs</h2>
        <p>Discovery, enrichment, messaging and AI features use third-party providers under your own accounts and at your own cost, unless a platform default is provided as part of your plan.</p>
        <h2>Availability</h2>
        <p>We work to keep the service available and secure but do not guarantee uninterrupted operation. Social platforms change their interfaces and policies; some features, in particular browser automation, may need updates and may be temporarily unavailable.</p>
        <h2>Suspension</h2>
        <p>CNEX AI may suspend a workspace that violates these terms, platform rules or applicable law. Members see a notice and can contact support.</p>
        <h2>Liability</h2>
        <p>To the extent permitted by law, CNEX AI is not liable for indirect or consequential losses arising from use of the service, including actions taken by connected platforms in response to your outreach.</p>
        <h2>Changes</h2>
        <p>We may update these terms; the effective date above will change and material changes will be announced in the changelog.</p>
        <h2>Contact</h2>
        <p>admin@cnexai.com</p>
      </div>
    </Section>
  );
}
