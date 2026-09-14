import { normalizeText } from "@oses/shared";

/**
 * Deterministic business-rule validation for AI-generated messages.
 *
 * The AI is told never to invent prices, MOQs, certifications, capacity, delivery dates or
 * existing relationships. This validator double-checks the output against the company's
 * configured facts so a hallucinated claim is caught before anything is sent.
 */

export interface RuleViolation {
  rule: string;
  detail: string;
  severity: "block" | "warn";
}

export interface RuleValidationResult {
  ok: boolean;
  violations: RuleViolation[];
}

export interface RuleContext {
  /** Verified company facts text (from loadCompanyContext). */
  factsText: string;
  /** Extra prohibited phrases configured by the organization (one per line). */
  prohibitedText?: string;
  /** Names/keywords the AI may legitimately use (brand name of the prospect, etc.). */
  allowedTerms?: string[];
  /** When true, pricing statements are always escalated regardless of facts. */
  escalatePricing?: boolean;
}

const CURRENCY_RE = /(?:\$|€|£|usd|eur|gbp|pkr|rs\.?)\s?\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s?(?:usd|eur|gbp|dollars|euros|pounds|pkr|rupees)\b/gi;
const MOQ_RE = /\b(?:moq|minimum order(?: quantity)?|minimum of)\s*(?:is|of|:)?\s*(\d[\d,]*)\s*(?:pcs|pieces|units|sets)?/gi;
const DELIVERY_RE = /\b(?:deliver(?:y|ed)?|ship(?:ping|ped)?|lead time|turnaround)\b[^.\n]{0,40}\b(\d{1,3})\s*(?:-\s*\d{1,3}\s*)?(?:days?|weeks?|business days)\b/gi;
const CERT_RE = /\b(iso\s?\d{4,5}|oeko[- ]?tex|gots|bsci|sedex|wrap|sa8000|fair\s?trade|ce\s?certified|fda\s?approved|reach\s?compliant)\b/gi;
const RELATIONSHIP_RE = /\b(as (?:we|you) (?:discussed|agreed|mentioned)|as per our (?:previous|last) (?:conversation|discussion|call|meeting)|our (?:previous|last|earlier) (?:order|conversation|call)|following up on our call|thanks for (?:your|the) order|great to (?:speak|talk) with you again|your (?:previous|last) order)\b/gi;
const GUARANTEE_RE = /\b(guarantee[ds]?|100% (?:quality|satisfaction)|risk[- ]free|lowest price|best price in the market|cheapest)\b/gi;

function factsContain(facts: string, snippet: string): boolean {
  const f = normalizeText(facts);
  const s = normalizeText(snippet);
  if (!s) return false;
  return f.includes(s);
}

function numbersIn(text: string): string[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, ""));
}

/** Numbers that appear on fact lines about a topic (e.g. MOQ lines only), so unrelated numbers cannot vouch for a claim. */
function topicNumbers(facts: string, topic: RegExp): Set<string> {
  const out = new Set<string>();
  for (const line of facts.split(/\n/)) if (topic.test(line)) for (const n of numbersIn(line)) out.add(n);
  return out;
}

const PRICE_TOPIC_RE = /price|pricing|cost|usd|eur|gbp|\$|€|£|per (?:piece|unit|pc)/i;
const MOQ_TOPIC_RE = /moq|minimum order|minimum of/i;
const PROHIBITED_PREFIX_RE = /^(?:never|do not|don't|avoid|no)\s*(?:say|use|mention|claim|promise|write|state)?\s*:?\s*/i;

export function validateMessageAgainstRules(message: string, ctx: RuleContext): RuleValidationResult {
  const violations: RuleViolation[] = [];
  const priceNumbers = topicNumbers(ctx.factsText, PRICE_TOPIC_RE);
  const moqNumbers = topicNumbers(ctx.factsText, MOQ_TOPIC_RE);

  // Prices
  for (const m of message.match(CURRENCY_RE) ?? []) {
    const nums = numbersIn(m);
    const known = nums.some((n) => priceNumbers.has(n));
    if (!known || ctx.escalatePricing) violations.push({ rule: "no_invented_prices", detail: `Pricing statement "${m.trim()}" is not part of the configured company facts`, severity: "block" });
  }
  // MOQ
  let moqMatch: RegExpExecArray | null;
  MOQ_RE.lastIndex = 0;
  while ((moqMatch = MOQ_RE.exec(message))) {
    const n = (moqMatch[1] ?? "").replace(/,/g, "");
    if (n && !moqNumbers.has(n)) violations.push({ rule: "no_invented_moq", detail: `MOQ "${n}" does not match the configured MOQ`, severity: "block" });
  }
  // Delivery promises
  DELIVERY_RE.lastIndex = 0;
  let d: RegExpExecArray | null;
  while ((d = DELIVERY_RE.exec(message))) {
    if (!factsContain(ctx.factsText, d[0])) violations.push({ rule: "no_invented_delivery", detail: `Delivery/lead-time promise "${d[0].trim()}" is not backed by company facts`, severity: "block" });
  }
  // Certifications
  for (const c of message.match(CERT_RE) ?? []) {
    if (!factsContain(ctx.factsText, c)) violations.push({ rule: "no_invented_certifications", detail: `Certification "${c}" is not listed in company facts`, severity: "block" });
  }
  // Relationship claims
  for (const r of message.match(RELATIONSHIP_RE) ?? []) {
    violations.push({ rule: "no_false_relationship", detail: `Implies an existing relationship: "${r}"`, severity: "block" });
  }
  // Guarantees / superlatives
  for (const g of message.match(GUARANTEE_RE) ?? []) {
    violations.push({ rule: "no_guarantees", detail: `Unsupported guarantee/superlative: "${g}"`, severity: "warn" });
  }
  // Organization-specific prohibited phrases
  if (ctx.prohibitedText) {
    const lines = ctx.prohibitedText
      .split(/\n|;/)
      .map((l) => l.replace(/^[-*#\s]+/, "").replace(PROHIBITED_PREFIX_RE, "").replace(/^["']|["'.]+$/g, "").trim())
      .filter((l) => l.length >= 3 && l.length <= 80);
    const norm = normalizeText(message);
    for (const phrase of lines) {
      if (norm.includes(normalizeText(phrase))) violations.push({ rule: "prohibited_phrase", detail: `Contains prohibited phrase "${phrase}"`, severity: "block" });
    }
  }
  // Length sanity for social DMs
  if (message.length > 1500) violations.push({ rule: "too_long", detail: `Message is ${message.length} characters; keep DMs concise`, severity: "warn" });
  if (/\[(?:name|brand|company|your name|insert[^\]]*)\]/i.test(message) || /\{\{[^}]+\}\}/.test(message)) {
    violations.push({ rule: "placeholder_left", detail: "Message still contains a template placeholder", severity: "block" });
  }
  return { ok: !violations.some((v) => v.severity === "block"), violations };
}

/** Message categories that must always go to a human when the corresponding escalation flag is on. */
export function intentRequiresEscalation(
  intent: string,
  flags: { escalatePricing: boolean; escalateNegotiation: boolean; escalateComplaints: boolean; escalateUnusual: boolean },
): string | null {
  if (intent === "PRICE_REQUEST" && flags.escalatePricing) return "Pricing questions are configured to require human review";
  if (intent === "NEGOTIATION" && flags.escalateNegotiation) return "Negotiation is configured to require human review";
  if (intent === "NEEDS_HUMAN") return "The AI flagged this conversation for a human";
  if (intent === "UNKNOWN" && flags.escalateUnusual) return "Unclear intent";
  return null;
}
