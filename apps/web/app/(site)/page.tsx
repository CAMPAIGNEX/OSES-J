import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, Eyebrow, FeatureCard, Headline, Marker, PosterCard, Section, Shapes } from "@/components/site/blocks";
import { FEATURES } from "@/content/features";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = {
  title: "OSES J · AI-powered social export sales system",
  description: "Find apparel, sportswear and fitness-wear buyers on Instagram and Facebook, organise them as clients, and sell with an AI sales agent that follows your rules.",
};

const WORKFLOW = [
  { n: "01", title: "Find", text: "Describe the buyer in plain language. Discovery providers search Instagram and Facebook; results are normalised, de-duplicated and scored." },
  { n: "02", title: "Save", text: "Keep the profiles that fit. Enrichment fills in websites, emails, phones and WhatsApp with the source of every field." },
  { n: "03", title: "Add to business", text: "One click creates a client with a permanent CID, duplicate protection, tags, notes and a timeline." },
  { n: "04", title: "AI contact", text: "The agent writes a personalised first message from your company facts. Send it yourself, through the extension, or through Meta." },
  { n: "05", title: "Follow up", text: "Replies are classified, answers drafted, follow-ups scheduled in the buyer timezone within your working hours and limits." },
  { n: "06", title: "Close", text: "Track stages, reply rates and usage. Escalate pricing and negotiation to a human whenever you want." },
];

const MODES = [
  { name: "Manual", color: "bg-surface", text: "You do everything; the AI only suggests when asked. Perfect while you learn the tool." },
  { name: "Copilot", color: "bg-bauhaus-yellow", text: "The AI drafts first messages, replies and follow-ups. Nothing goes out until you approve it." },
  { name: "Autopilot", color: "bg-bauhaus-blue text-white", text: "The AI sends within the limits you set: confidence threshold, escalation rules, daily caps, working hours, do-not-contact." },
];

export default async function HomePage() {
  const signedIn = Boolean(await getSession());
  return (
    <>
      {/* Hero */}
      <Section className="grid items-center gap-12 pb-10 pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:pt-20">
        <div>
          <Eyebrow>Social export sales · Instagram + Facebook</Eyebrow>
          <Headline as="h1" className="mt-6 text-[44px] sm:text-6xl lg:text-7xl">
            Find buyers.
            <br />
            <span className="bg-bauhaus-yellow px-2 text-ink">Sell with</span>
            <br />
            an AI agent.
          </Headline>
          <p className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted">OSES J finds new apparel, sportswear and fitness-wear brands on Instagram and Facebook, enriches their public business details, organises them into a CRM with permanent IDs, and lets an AI sales agent contact and follow up with them, on your rules, in your voice.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={signedIn ? "/dashboard" : "/register"} data-ui="button" data-variant="primary" className="inline-flex h-12 items-center px-6 text-[13px]">
              {signedIn ? "Open the app" : "Create your workspace"}
            </Link>
            <Link href="/how-it-works" data-ui="button" data-variant="outline" className="inline-flex h-12 items-center px-6 text-[13px]">
              See how it works
            </Link>
            <Marker className="ml-1">no invented prices, ever</Marker>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4">
            {[
              ["2", "platforms"],
              ["3", "AI modes"],
              ["1", "inbox"],
            ].map(([n, label]) => (
              <div key={label} className="border-l-4 border-ink pl-3">
                <dt className="poster-number text-3xl">{n}</dt>
                <dd className="text-[12px] uppercase tracking-[0.12em] text-muted">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Shapes className="hidden h-[420px] lg:block" />
      </Section>

      {/* Workflow */}
      <Section id="workflow" className="pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow tone="blue">The workflow</Eyebrow>
            <Headline className="mt-4 text-3xl sm:text-5xl">Find → Save → Add → Contact → Follow up → Close</Headline>
          </div>
          <Marker>six steps, one screen each</Marker>
        </div>
        <ol className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {WORKFLOW.map((step, i) => (
            <li key={step.n}>
              <PosterCard tape={i % 2 === 0} className="h-full">
                <span className={`poster-number inline-block border-2 border-ink px-2 py-1 text-2xl ${i % 3 === 0 ? "bg-bauhaus-red text-white" : i % 3 === 1 ? "bg-bauhaus-blue text-white" : "bg-bauhaus-yellow"}`}>{step.n}</span>
                <h3 className="mt-4 font-display text-[18px] uppercase">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-muted">{step.text}</p>
              </PosterCard>
            </li>
          ))}
        </ol>
      </Section>

      {/* Features */}
      <Section id="features" className="pt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>Everything inside</Eyebrow>
            <Headline className="mt-4 text-3xl sm:text-5xl">A complete export sales desk</Headline>
          </div>
          <Link href="/features" className="text-[12px] font-bold uppercase tracking-[0.12em] underline decoration-2 underline-offset-4">
            All features
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.slice(0, 6).map((f) => (
            <FeatureCard key={f.slug} feature={f} />
          ))}
        </div>
      </Section>

      {/* Modes */}
      <Section className="pt-6">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Eyebrow tone="yellow">Human in control</Eyebrow>
            <Headline className="mt-4 text-3xl sm:text-5xl">Manual. Copilot. Autopilot.</Headline>
            <p className="mt-4 text-[14px] leading-relaxed text-muted">Choose how much the AI does. Whatever the mode, it never bypasses approvals, working hours, rate limits, escalation rules or do-not-contact flags, and every decision is logged.</p>
            <Marker className="mt-6 block">flip it any time, pause everything with one switch</Marker>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {MODES.map((m) => (
              <div key={m.name} className={`border-2 border-ink p-5 shadow-[4px_4px_0_0_var(--ink)] ${m.color}`}>
                <h3 className="font-display text-[16px] uppercase">{m.name}</h3>
                <p className="mt-2 text-[13px] leading-relaxed opacity-90">{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Trust */}
      <Section className="pt-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { t: "Sources on every field", d: "Emails, phones and websites show where they came from (profile, bio, website, structured data) and how confident we are. Nothing is guessed." },
            { t: "Your own accounts", d: "Messages go out through the official Meta API or a browser extension running in your logged-in session. OSES J never asks for your Instagram password." },
            { t: "Encrypted and audited", d: "Provider tokens and AI keys are encrypted at rest, sessions are hashed, webhooks are signed, and the audit log records who did what." },
          ].map((item) => (
            <PosterCard key={item.t} tape={false}>
              <h3 className="font-display text-[15px] uppercase">{item.t}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">{item.d}</p>
            </PosterCard>
          ))}
        </div>
      </Section>

      <CtaBand signedIn={signedIn} />
    </>
  );
}
