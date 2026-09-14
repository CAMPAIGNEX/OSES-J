import type { Metadata } from "next";
import { Eyebrow, Headline, Section } from "@/components/site/blocks";

export const metadata: Metadata = { title: "Privacy policy", description: "How OSES J handles workspace data, public business information and provider credentials." };

export default function PrivacyPage() {
  return (
    <Section>
      <Eyebrow tone="blue">Legal</Eyebrow>
      <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">Privacy policy</Headline>
      <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-faint">Effective 14 September 2026</p>
      <div className="prose-doc mt-8 max-w-3xl">
        <h2>Who we are</h2>
        <p>OSES J is operated by CNEX AI ("we"). This policy explains what data the service processes and why. Contact: privacy@cnexai.com.</p>
        <h2>Workspace data</h2>
        <p>Your workspace contains the accounts of your team members, your company facts, the leads and clients you collect, messages, documents, settings and provider credentials. This data belongs to your organisation. We process it only to provide the service and never sell it.</p>
        <h2>Public business information</h2>
        <p>Lead discovery and enrichment collect information that businesses publish about themselves on Instagram, Facebook and their own websites (brand name, public profile details, business contact channels). Every field stores its source. You are responsible for using this information in line with the laws that apply to your outreach, including opt-out requests, which OSES J enforces once recorded.</p>
        <h2>Provider credentials</h2>
        <p>Apify tokens, AI provider keys and Meta access tokens are encrypted at rest with a key that is never stored in the database. They are used only to call the provider on your behalf.</p>
        <h2>Messaging accounts</h2>
        <p>OSES J never asks for or stores your Instagram or Facebook password. The browser extension operates inside your own browser session; the official Meta integration uses tokens you grant through Meta and can revoke at any time.</p>
        <h2>AI processing</h2>
        <p>When you use AI features, the relevant company facts, lead details and conversation text are sent to the AI provider you configured (or the platform default) to generate the result. Every AI action is logged in your workspace.</p>
        <h2>Security</h2>
        <p>Sessions are stored as hashes, sign-in is rate limited, webhooks are signature-verified, uploaded files are stored outside the web root, and an audit log records important actions.</p>
        <h2>Retention and deletion</h2>
        <p>Deleted items stay in Trash for 7 days and are then purged. You can request deletion of an entire workspace by contacting us.</p>
        <h2>Changes</h2>
        <p>We will update this page when the policy changes and note the effective date above.</p>
      </div>
    </Section>
  );
}
