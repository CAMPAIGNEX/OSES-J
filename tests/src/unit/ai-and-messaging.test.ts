import { describe, expect, it } from "vitest";
import { chunkText, intentRequiresEscalation, validateMessageAgainstRules } from "@oses/ai";
import { interpretDmActorItems, retryDelayMs } from "@oses/automation";
import { createOAuthState, handleVerification, parseOAuthState, verifyWebhookSignature } from "@oses/messaging";
import { createHmac } from "node:crypto";
import { resetEnvCache } from "@oses/shared";

describe("AI business rules", () => {
  const facts = "Company: ABC Sportswear\nMOQ: 500 units per style\nCertifications: OEKO-TEX Standard 100\nShipping: sea and air freight worldwide";
  it("passes a compliant message", () => {
    const res = validateMessageAgainstRules("Hi Urban Fit, we manufacture private-label sportswear in Sialkot. Our MOQ is 500 units per style. Would you be open to a quick chat?", { factsText: facts });
    expect(res.ok).toBe(true);
    expect(res.violations).toHaveLength(0);
  });
  it("blocks invented prices, MOQ, certifications and relationship claims", () => {
    const res = validateMessageAgainstRules("As we discussed last week, our MOQ is 100 pieces at $4.50 each, we are ISO 9001 and GOTS certified and can deliver within 7 days.", { factsText: facts });
    const rules = res.violations.map((v) => v.rule);
    expect(res.ok).toBe(false);
    expect(rules).toEqual(expect.arrayContaining(["no_false_relationship", "no_invented_moq", "no_invented_prices", "no_invented_certifications", "no_invented_delivery"]));
  });
  it("respects organization prohibited phrases and template placeholders", () => {
    const res = validateMessageAgainstRules("Hello [Name], we offer the cheapest hoodies in town.", { factsText: facts, prohibitedText: "Never say: cheapest hoodies in town" });
    expect(res.violations.map((v) => v.rule)).toEqual(expect.arrayContaining(["placeholder_left", "prohibited_phrase"]));
  });
  it("escalates according to settings", () => {
    const flags = { escalatePricing: true, escalateNegotiation: true, escalateComplaints: true, escalateUnusual: true };
    expect(intentRequiresEscalation("PRICE_REQUEST", flags)).toBeTruthy();
    expect(intentRequiresEscalation("PRICE_REQUEST", { ...flags, escalatePricing: false })).toBeNull();
    expect(intentRequiresEscalation("CATALOG_REQUEST", flags)).toBeNull();
    expect(intentRequiresEscalation("NEEDS_HUMAN", flags)).toBeTruthy();
  });
});

describe("knowledge chunking", () => {
  it("splits long text into overlapping chunks under the limit", () => {
    const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} about hoodies, fabrics and minimum order quantities for private label production.`).join("\n\n");
    const chunks = chunkText(text, { maxChars: 500, overlapChars: 80 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(520);
    expect(chunks.join(" ")).toContain("Paragraph 39");
  });
});

describe("job retry policy", () => {
  it("backs off temporary errors and never retries permanent ones", () => {
    expect(retryDelayMs(1, "TEMPORARY")).toBe(30_000);
    expect(retryDelayMs(2, "TEMPORARY")).toBe(120_000);
    expect(retryDelayMs(3, "TEMPORARY")).toBe(600_000);
    expect(retryDelayMs(1, "RATE_LIMIT")).toBeGreaterThanOrEqual(600_000);
    expect(retryDelayMs(1, "PERMANENT")).toBeNull();
    expect(retryDelayMs(1, "AUTHENTICATION")).toBeNull();
    expect(retryDelayMs(1, "USER_ACTION_REQUIRED")).toBeNull();
  });
  it("only treats explicit actor confirmations as sent", () => {
    expect(interpretDmActorItems([{ status: "sent", threadId: "123" }], "item_status")).toMatchObject({ sent: true, threadId: "123" });
    expect(interpretDmActorItems([{ error: "Account restricted" }], "item_status").sent).toBe(false);
    expect(interpretDmActorItems([], "item_status").sent).toBe(false);
    expect(interpretDmActorItems([{ foo: "bar" }], "item_status").sent).toBe(false);
    expect(interpretDmActorItems([], "run_succeeded").sent).toBe(true);
  });
});

describe("Meta webhook security", () => {
  it("validates X-Hub-Signature-256", () => {
    const body = JSON.stringify({ object: "instagram", entry: [] });
    const sig = "sha256=" + createHmac("sha256", "app-secret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "app-secret")).toBe(true);
    expect(verifyWebhookSignature(body, sig, "other-secret")).toBe(false);
    expect(verifyWebhookSignature(body, "sha256=deadbeef", "app-secret")).toBe(false);
    expect(verifyWebhookSignature(body, null, "app-secret")).toBe(false);
  });
  it("answers the verification handshake only with the right token", () => {
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-me";
    resetEnvCache();
    expect(handleVerification(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42" }), "verify-me")).toEqual({ ok: true, challenge: "42" });
    expect(handleVerification(new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "42" }), "verify-me").ok).toBe(false);
  });
  it("round-trips signed OAuth state and rejects tampering", () => {
    const state = createOAuthState("org-1", "user-1");
    expect(parseOAuthState(state)).toEqual({ organizationId: "org-1", userId: "user-1" });
    const tampered = Buffer.from(Buffer.from(state, "base64url").toString("utf8").replace("org-1", "org-2")).toString("base64url");
    expect(parseOAuthState(tampered)).toBeNull();
  });
});
