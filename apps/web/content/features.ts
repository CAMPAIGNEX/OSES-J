/**
 * Feature registry for the public website (/features and /features/[slug]).
 * Keep in sync with the product: when a feature ships or changes, update its entry and the matching doc.
 */
export interface Feature {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  icon: "search" | "bookmark" | "users" | "inbox" | "bot" | "megaphone" | "file" | "building" | "trending" | "chart" | "plug" | "shield";
  accent: "red" | "blue" | "yellow" | "pink" | "green";
  highlights: string[];
  steps: string[];
  doc: string;
}

export const FEATURES: Feature[] = [
  {
    slug: "lead-search",
    name: "Search Leads",
    tagline: "Describe the buyer. Get a list.",
    description: "Type a plain-language query such as \"New apparel brands in New York\" and OSES-J turns it into structured criteria, runs the discovery providers, normalizes every profile, removes duplicates and scores the results.",
    icon: "search",
    accent: "red",
    highlights: ["Natural-language queries plus explicit filters (platform, followers, location, category)", "Instagram and Facebook through configurable Apify Actors", "Every contact field carries its source and confidence", "Search history and one-click saved searches"],
    steps: ["Open Search Leads and describe who you are looking for.", "Adjust platform, follower range and location if needed.", "Run the search; results arrive with a score and the reasons behind it.", "Save the leads you like or add them to your business straight away."],
    doc: "finding-leads",
  },
  {
    slug: "enrichment",
    name: "Enrichment",
    tagline: "Public business details, labelled.",
    description: "Profiles are completed with public information: website contact pages, emails, phones, WhatsApp numbers, linked social accounts and structured data, each tagged with where it came from.",
    icon: "bookmark",
    accent: "blue",
    highlights: ["Website contact extraction with SSRF-safe fetching", "Profile enrichment through platform providers", "Entity resolution links the same business across platforms", "Timezone detection from the buyer location"],
    steps: ["Enrichment runs automatically after a search.", "Open a lead to see the source of every field.", "Re-run enrichment from the lead or client profile at any time."],
    doc: "finding-leads",
  },
  {
    slug: "clients",
    name: "Clients & CRM",
    tagline: "Permanent IDs. Zero duplicates.",
    description: "Add to Business turns a lead into a client with a permanent CID (CX-000001 and up), duplicate protection, tags, notes, activities, documents and a full timeline.",
    icon: "users",
    accent: "yellow",
    highlights: ["Sequential CIDs that are never reused", "Duplicate detection by profile, website, email and phone", "Tags, notes, statuses and an activity timeline", "Trash with 7-day restore"],
    steps: ["Select leads and click Add to Business.", "Review the client profile: contacts, eligibility, timeline.", "Use tags and statuses to organise your pipeline."],
    doc: "clients-and-crm",
  },
  {
    slug: "inbox",
    name: "Unified Inbox",
    tagline: "Instagram and Facebook in one thread list.",
    description: "Every conversation with a client in one place: manual sends, extension sends, official Meta replies, delivery states where available, approvals and scheduled follow-ups.",
    icon: "inbox",
    accent: "pink",
    highlights: ["Composer with AI generate, regenerate, shorter, more professional, more friendly and personalize", "Manual, browser-extension, Apify or official Meta delivery with transparent provider decisions", "Approvals for AI drafts", "Scheduling in the buyer timezone and working hours"],
    steps: ["Open a client and write or generate a first message.", "Send it yourself or let automation deliver it.", "Reply from the inbox; log messages exchanged elsewhere."],
    doc: "messaging-and-inbox",
  },
  {
    slug: "ai-assistant",
    name: "AI Sales Agent",
    tagline: "Trained on your facts. Never invents.",
    description: "The AI writes first messages, classifies replies, drafts answers and follow-ups using your company facts, instructions and knowledge base. Deterministic rules block invented prices, MOQs, certifications or delivery promises.",
    icon: "bot",
    accent: "blue",
    highlights: ["Manual, Copilot and Autopilot modes", "Intent classification and escalation rules", "TXT knowledge base with retrieval", "Every AI action is logged"],
    steps: ["Fill in company facts and instructions.", "Upload product and pricing documents to the knowledge base.", "Choose Manual, Copilot or Autopilot and set the limits."],
    doc: "ai-assistant",
  },
  {
    slug: "campaigns",
    name: "Campaigns",
    tagline: "Outreach at a rhythm you control.",
    description: "Build an audience, choose AI or template first messages, define the follow-up ladder, working hours, daily limits and approval gates, then start, pause or stop with one click.",
    icon: "megaphone",
    accent: "red",
    highlights: ["Audiences from saved leads and clients", "Follow-up ladders in the buyer timezone", "Daily and hourly limits", "Approval gates for AI drafts"],
    steps: ["Create a campaign and pick the audience.", "Set the message strategy and limits.", "Start the campaign and watch the progress."],
    doc: "campaigns",
  },
  {
    slug: "documents",
    name: "Documents",
    tagline: "Catalogues and price lists, ready to attach.",
    description: "Store catalogues, size charts and certificates once; attach them to messages and use them as AI knowledge.",
    icon: "file",
    accent: "green",
    highlights: ["Uploads stored outside the web root", "Attach to messages and campaigns", "TXT documents feed the AI knowledge base"],
    steps: ["Upload documents in Documents.", "Attach from the composer or campaign settings."],
    doc: "documents",
  },
  {
    slug: "competitor-analysis",
    name: "Competitor Analysis",
    tagline: "Observed data, separated from opinion.",
    description: "Analyse competitor accounts: posting cadence, hashtags, engagement and content themes. Observed metrics are shown separately from the AI interpretation.",
    icon: "building",
    accent: "yellow",
    highlights: ["Content provider through Apify", "Observed metrics versus AI interpretation", "Exportable results"],
    steps: ["Enter competitor accounts.", "Run the analysis and review the observed data.", "Read the AI interpretation and talking points."],
    doc: "analysis",
  },
  {
    slug: "trend-analysis",
    name: "Trend Analysis",
    tagline: "What is moving in your niche.",
    description: "Hashtag and topic trends for your product categories, with observed engagement and an AI reading of what to pitch.",
    icon: "trending",
    accent: "pink",
    highlights: ["Hashtag discovery", "Engagement aggregation", "Pitch ideas grounded in observed content"],
    steps: ["Choose hashtags or categories.", "Run the analysis.", "Use the talking points in your outreach."],
    doc: "analysis",
  },
  {
    slug: "performance",
    name: "Performance & Dashboard",
    tagline: "Numbers you can act on.",
    description: "Dashboard tiles, performance charts with presets and custom ranges, funnel stages, reply rates and AI usage.",
    icon: "chart",
    accent: "blue",
    highlights: ["Interactive charts", "Presets and custom ranges", "Usage metering for AI and providers"],
    steps: ["Open Performance.", "Pick a range.", "Drill into the stage that needs attention."],
    doc: "analysis",
  },
  {
    slug: "integrations",
    name: "Integrations",
    tagline: "Apify, Meta, the browser extension.",
    description: "Discovery and enrichment through Apify Actors; official Instagram and Facebook messaging through Meta; a Chrome extension that sends approved messages from your own logged-in session.",
    icon: "plug",
    accent: "green",
    highlights: ["Discovery and enrichment providers activated and maintained by the CNEX AI team", "Meta OAuth, signed webhooks, delivery receipts", "Chrome MV3 extension with step-by-step verification"],
    steps: ["Check Settings > Automation > Services to see what is active.", "Connect Meta Pages in Settings > Social accounts.", "Pair the extension from Settings > Automation."],
    doc: "integrations",
  },
  {
    slug: "security",
    name: "Security & Control",
    tagline: "Multi-tenant. Encrypted. Audited.",
    description: "Separate workspaces per company, encrypted secrets, hashed sessions, signed webhooks, audit log, rate limits, approvals and an emergency stop for automation.",
    icon: "shield",
    accent: "red",
    highlights: ["AES-256-GCM secrets at rest", "Audit log of every important action", "Pause-all-automation switch", "Do-not-contact and opt-out enforcement"],
    steps: ["Invite team members with roles.", "Review the audit log in Settings.", "Use the emergency stop when needed."],
    doc: "administration",
  },
];

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
