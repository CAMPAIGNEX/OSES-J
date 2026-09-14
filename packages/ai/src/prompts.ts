import type { CompanyContext, RetrievedChunk } from "./knowledge";

/** Data about a prospect that may be used for personalization (only what is actually known). */
export interface ClientProfileForAI {
  cid: string;
  brandName: string;
  companyName?: string | null;
  category?: string | null;
  website?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  followers?: number | null;
  bio?: string | null;
  platform?: string | null;
  username?: string | null;
  status?: string | null;
  tags?: string[];
  notes?: string | null;
  /** Short snippets of recent public content (captions/titles), if collected. */
  recentContent?: string[];
  /** Existing AI analysis summary, if any. */
  analysisSummary?: string | null;
}

export interface ConversationMessageForAI {
  direction: "INBOUND" | "OUTBOUND";
  authorType: "USER" | "AI" | "SYSTEM" | "CLIENT";
  body: string;
  sentAt: Date | null;
}

export interface ConversationForAI {
  channel: string;
  messages: ConversationMessageForAI[];
  summary?: string | null;
}

export interface PromptOptions {
  company: CompanyContext;
  knowledge?: RetrievedChunk[];
  tone?: string | null;
  language?: string | null;
}

const HARD_RULES = `HARD RULES (never break these):
- Never invent facts. Only state prices, MOQ, certifications, production capacity, delivery times, shipping terms or company history if they appear in COMPANY FACTS or KNOWLEDGE below. If something is not there, say a team member will confirm it.
- Never claim an existing relationship, previous order, previous call or prior agreement with the prospect.
- Never promise delivery dates, guarantees, or "lowest prices".
- Do not use pushy, spammy or manipulative language. No excessive emojis, no ALL CAPS, no fake urgency.
- Personalize only with information visible in the prospect profile. Do not mention private or sensitive details and do not reveal that the profile was scraped.
- Write as a real person from the company (first person plural "we"). No placeholders like [Name].
- If the prospect asks not to be contacted, acknowledge politely and stop.`;

export function buildSystemPrompt(task: string, opts: PromptOptions): string {
  const { company } = opts;
  const parts: string[] = [];
  parts.push(`You are the B2B sales assistant of ${company.organization.name}, an apparel/sportswear manufacturer and exporter. ${task}`);
  parts.push(HARD_RULES);
  parts.push(`COMPANY FACTS (verified, use only these):\n${company.factsText || "(no company facts configured yet)"}`);
  if (company.toneText || opts.tone) parts.push(`TONE:\n${[company.toneText, opts.tone ? `Preferred tone: ${opts.tone}` : ""].filter(Boolean).join("\n")}`);
  else parts.push("TONE: professional, friendly, concise, B2B. Short paragraphs. No hype.");
  if (opts.language) parts.push(`LANGUAGE: write in ${opts.language}.`);
  if (company.instructionsText) parts.push(`COMPANY INSTRUCTIONS:\n${company.instructionsText}`);
  if (company.prohibitedText) parts.push(`PROHIBITED (never do or say):\n${company.prohibitedText}`);
  if (company.escalationText) parts.push(`ESCALATION RULES:\n${company.escalationText}`);
  if (opts.knowledge?.length) {
    parts.push(`KNOWLEDGE (retrieved from company documents; cite facts from here only):\n${opts.knowledge.map((k, i) => `[${i + 1}] (${k.title}) ${k.content}`).join("\n\n")}`);
  }
  return parts.join("\n\n");
}

export function renderClientProfile(client: ClientProfileForAI): string {
  const lines: string[] = [];
  const add = (label: string, value: unknown) => {
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return;
    lines.push(`${label}: ${Array.isArray(value) ? value.join("; ") : String(value)}`);
  };
  add("Brand", client.brandName);
  add("Company", client.companyName);
  add("Category", client.category);
  add("Platform", client.platform ? `${client.platform}${client.username ? ` (@${client.username})` : ""}` : null);
  add("Followers", client.followers);
  add("Website", client.website);
  add("Location", [client.city, client.region, client.country].filter(Boolean).join(", "));
  add("Bio", client.bio);
  add("Recent public content", client.recentContent?.slice(0, 5));
  add("Tags", client.tags);
  add("Internal notes", client.notes);
  add("Previous AI analysis", client.analysisSummary);
  add("Status in our CRM", client.status);
  return lines.length ? lines.join("\n") : "(no profile information available)";
}

export function renderConversation(conv: ConversationForAI, maxMessages = 30): string {
  const msgs = conv.messages.slice(-maxMessages);
  if (!msgs.length) return "(no messages yet)";
  return msgs
    .map((m) => {
      const who = m.direction === "INBOUND" ? "PROSPECT" : m.authorType === "AI" ? "US (AI draft sent)" : "US";
      const when = m.sentAt ? ` [${m.sentAt.toISOString().slice(0, 16).replace("T", " ")}]` : "";
      return `${who}${when}: ${m.body}`;
    })
    .join("\n");
}
