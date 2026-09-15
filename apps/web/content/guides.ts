/**
 * Short "how to use this" instructions shown at the top of every feature page (see
 * components/layout/feature-guide.tsx). Keep each guide to a few plain sentences; the full
 * explanation lives in the manual page linked by `docs`.
 */
export interface FeatureGuide {
  title: string;
  steps: string[];
  /** Manual page under /docs */
  docs: string;
}

export const GUIDES: Record<string, FeatureGuide> = {
  "search-leads": {
    title: "How to find leads",
    steps: [
      "Describe the buyer in plain words, product first, place second: “gym accessories brands in New York”. Any spelling of the city works (newyork, NYC).",
      "Pick a platform and, if you want, a follower range. 1,000–100,000 is a good first range; a very narrow range removes most results.",
      "Click Find leads. The run shows how many accounts were found, what your filters removed and what each provider did.",
      "Select the good ones and Save, Add to Business, Tag or Export. Every lead you have ever found stays in Hunted Leads.",
    ],
    docs: "finding-leads",
  },
  "hunted-leads": {
    title: "What Hunted Leads is",
    steps: [
      "Every account OSES-J has ever found for your workspace, from every search, newest first. Nothing is lost when you leave a results page.",
      "Filter by search, platform, place, followers, contacts or tag; search by brand, username, bio or email.",
      "Save the promising ones so they appear in Saved Leads, or Add to Business to turn them into clients with a permanent CID.",
      "Select leads and Export to Excel at any time.",
    ],
    docs: "finding-leads",
  },
  "saved-leads": {
    title: "How to use Saved Leads",
    steps: [
      "Saved Leads is your shortlist: leads you marked with Save from a search or from Hunted Leads.",
      "Open a lead to see its sources, contacts and score breakdown; add notes and tags.",
      "Add to Business when a lead becomes a real prospect: it gets a client ID (CID) and moves into Clients.",
    ],
    docs: "finding-leads",
  },
  clients: {
    title: "How Clients work",
    steps: [
      "A client is a lead you decided to work with. Each one has a permanent CID, contacts with sources, notes, tags and the full message history.",
      "Use the status to track where each client is (new, contacted, in talks, won, lost).",
      "Message a client from the inbox; the AI agent can draft or send replies depending on your mode.",
    ],
    docs: "clients-and-crm",
  },
  inbox: {
    title: "How the inbox works",
    steps: [
      "One inbox for Instagram and Facebook. Conversations arrive through the official Meta connection or the browser extension.",
      "Write a message or ask the AI for variants; choose how it is delivered (manual, extension, official API).",
      "Schedule follow-ups, set reminders and let Copilot / Autopilot handle replies within your working hours and limits.",
    ],
    docs: "messaging-and-inbox",
  },
  "ai-assistant": {
    title: "How the AI assistant works",
    steps: [
      "Give it your company facts, instructions and knowledge documents. It only ever uses what you gave it; no invented prices, MOQs or certifications.",
      "Choose a mode: Manual (drafts only), Copilot (suggests, you approve) or Autopilot (sends within your rules).",
      "Every decision is logged; review the action log and adjust instructions when something is off.",
    ],
    docs: "ai-assistant",
  },
  campaigns: {
    title: "How campaigns work",
    steps: [
      "A campaign sends a sequence of messages to a list of leads or clients, respecting working hours, daily limits and do-not-contact.",
      "Pick the audience from Hunted, Saved or Clients, write the steps (or let the AI draft them), set the delays and start.",
      "Pause any time; replies pull a contact out of the sequence automatically.",
    ],
    docs: "campaigns",
  },
  documents: {
    title: "How documents work",
    steps: [
      "Upload catalogues, price lists and certificates once; attach them to messages and let the AI use them as knowledge.",
      "Exports (Excel) and generated reports also appear here.",
    ],
    docs: "documents",
  },
  competitors: {
    title: "How competitor analysis works",
    steps: [
      "Enter a competitor brand or account. OSES-J collects their recent posts and audience signals and the AI summarises positioning, products and pricing cues.",
      "Reports are saved so you can compare over time.",
    ],
    docs: "analysis",
  },
  trends: {
    title: "How trend analysis works",
    steps: [
      "Enter a product or hashtag. OSES-J collects recent content around it and the AI summarises what is rising, who posts it and where.",
      "Use the findings as keywords for your next lead search.",
    ],
    docs: "analysis",
  },
  performance: {
    title: "How to read Performance",
    steps: [
      "Leads found, saved, converted; messages sent, replies, response times; AI decisions. Pick a date range to compare periods.",
      "Numbers come from your own activity only; nothing is estimated.",
    ],
    docs: "analysis",
  },
  trash: {
    title: "How Trash works",
    steps: ["Deleted leads, clients and documents stay here for 7 days and can be restored; after that they are removed for good."],
    docs: "clients-and-crm",
  },
};
