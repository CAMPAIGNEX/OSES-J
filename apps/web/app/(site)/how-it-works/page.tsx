import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand, Eyebrow, Headline, Marker, PosterCard, Section } from "@/components/site/blocks";
import { getSession } from "@/lib/server/session";

export const metadata: Metadata = { title: "How it works", description: "From a plain-language search to a closed deal: how OSES J discovers, enriches, organises and contacts buyers with an AI agent under your control." };

const STAGES = [
  {
    title: "1 · Discovery",
    color: "bg-bauhaus-red text-white",
    body: "You type something like \"New apparel brands in New York\". The query parser extracts keywords, category and location; you can override any of them. Discovery providers (Apify Actors for search-engine, profile and hashtag strategies) run in order until your quota is reached.",
    detail: ["Instagram and Facebook", "Follower ranges, location, category and contact filters", "Every run is recorded with cost and status"],
  },
  {
    title: "2 · Normalisation & de-duplication",
    color: "bg-bauhaus-blue text-white",
    body: "Raw provider output becomes one clean record per business. Emails, phones and WhatsApp numbers found in bios are stored with their source. Duplicates are merged by handle, id, website, email and phone, then by fuzzy brand matching. Nothing is invented: if the provider did not return a city, the lead has no city.",
    detail: ["Sourced contacts with confidence", "Cross-platform entity resolution", "Scores with a visible breakdown"],
  },
  {
    title: "3 · Enrichment",
    color: "bg-bauhaus-yellow text-ink",
    body: "Leads missing details are completed from public sources: the website home and contact pages (structured data, mailto and tel links, visible text) and platform profile providers. Websites are fetched safely (public hosts only, size and time limits).",
    detail: ["Contact pages and structured data", "Linked social accounts", "Timezone from the buyer location"],
  },
  {
    title: "4 · Save and add to business",
    color: "bg-pop-pink text-ink",
    body: "Save the leads you like, then Add to Business. Each client gets a permanent CID (CX-000001 and up) that is never reused, even after deletion. Adding the same business twice returns the existing client instead of a duplicate.",
    detail: ["Permanent CIDs", "Tags, notes, statuses, timeline", "Trash with 7-day restore"],
  },
  {
    title: "5 · AI contact",
    color: "bg-pop-green text-ink",
    body: "The AI writes a personalised first message using the lead profile and your company facts (products, MOQ, certifications, markets, lead times). A rule validator blocks invented prices, MOQs, certifications, delivery promises or relationship claims before anything is sent.",
    detail: ["Generate, regenerate, shorter, more professional, more friendly, personalise", "Manual send, browser extension, Apify or official Meta API", "Transparent provider decisions"],
  },
  {
    title: "6 · Follow up and close",
    color: "bg-surface",
    body: "Replies land in the unified inbox and are classified (interested, price request, catalogue request, negotiation, not interested, opt-out and more). Depending on the mode the AI suggests or sends the answer, schedules follow-ups in the buyer timezone within your working hours, and escalates pricing or negotiation to a human when configured.",
    detail: ["Copilot approvals or Autopilot limits", "Working hours, daily caps, do-not-contact", "Performance dashboard and audit log"],
  },
];

export default async function HowItWorksPage() {
  const signedIn = Boolean(await getSession());
  return (
    <>
      <Section className="pb-6">
        <Eyebrow tone="blue">How it works</Eyebrow>
        <Headline as="h1" className="mt-4 text-4xl sm:text-6xl">From a sentence to a signed order</Headline>
        <p className="mt-4 max-w-2xl text-[15px] text-muted">Six stages, each one visible in the app. External providers sit behind interfaces, so the workflow stays the same when a provider changes.</p>
        <Marker className="mt-4 block">read this once, then read the manual</Marker>
      </Section>
      <Section className="pt-4">
        <ol className="space-y-6">
          {STAGES.map((s, i) => (
            <li key={s.title} className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className={`border-2 border-ink p-5 shadow-[4px_4px_0_0_var(--ink)] ${s.color}`}>
                <span className="poster-number text-4xl">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 font-display text-[16px] uppercase leading-tight">{s.title.replace(/^\d · /, "")}</h2>
              </div>
              <PosterCard tape={false}>
                <p className="text-[14px] leading-relaxed">{s.body}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {s.detail.map((d) => (
                    <li key={d} data-ui="badge" data-tone="neutral" className="border px-2 py-0.5 text-[12px]">
                      {d}
                    </li>
                  ))}
                </ul>
              </PosterCard>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-[13px] text-muted">
          Want the details of each screen? The{" "}
          <Link href="/docs" className="font-bold underline decoration-2 underline-offset-4">
            manual
          </Link>{" "}
          covers every feature step by step.
        </p>
      </Section>
      <CtaBand signedIn={signedIn} />
    </>
  );
}
