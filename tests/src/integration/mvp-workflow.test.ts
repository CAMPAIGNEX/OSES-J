/**
 * End-to-end MVP workflow against a real MySQL database (TEST_DATABASE_URL):
 *   search -> normalize/dedupe -> save -> add to business (CID) -> AI first message -> send -> inbox
 *   -> inbound reply -> AI classification/reply -> autopilot controls -> failure cases.
 *
 * External providers are replaced with in-memory fakes; the database, services and job runner are real.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateFirstMessage, setAIProviderForTests, type AIGenerateRequest, type AIProvider, type AIResult } from "@oses/ai";
import { addLeadsToBusinessCompat, createRunner, getJobQueue, handleAiReplyJob, loadPolicy, MysqlJobQueue, runSchedulerTick } from "./helpers";
import { allocateClientCid, disconnectDb, getDb, type PrismaClient } from "@oses/database";
import { createSearchRun, executeSearchRun, listLeads, setDiscoveryProvidersForTests, setLeadsSaved, type DiscoveryProvider, type DiscoveryResult } from "@oses/discovery";
import { setProfileProvidersForTests } from "@oses/enrichment";
import { createOutboundMessage, listConversations, logManualMessage, processMetaWebhook, resolveMessagingProvider, targetFromSocialAccount } from "@oses/messaging";
import { encryptSecret, hashPassword } from "@oses/shared";

const hasDb = Boolean(process.env.TEST_DATABASE_URL);
const d = hasDb ? describe : describe.skip;

/** Fake AI provider: deterministic JSON matching whichever schema the agent asks for. */
class FakeAI implements AIProvider {
  readonly key = "fake";
  readonly model = "fake-model";
  calls: AIGenerateRequest[] = [];
  async generate(request: AIGenerateRequest): Promise<AIResult> {
    this.calls.push(request);
    const name = request.jsonSchema?.name;
    let json: unknown;
    if (name === "draft_message") json = { message: "Hi Urban Fit, we manufacture private-label activewear in Sialkot and liked your running collection. Would you be open to discussing your next production run?", personalizationUsed: ["bio"], factsUsed: ["Products"], openQuestions: [], confidence: 0.91 };
    else if (name === "intent") json = { intent: "CATALOG_REQUEST", confidence: 0.95, summary: "Wants the catalog", needsHuman: false, needsHumanReason: null, optOut: false };
    else if (name === "lead_analysis") json = { summary: "Activewear brand", fitScore: 80, likelyProducts: ["leggings"], talkingPoints: ["running collection"], risks: [], suggestedChannel: "INSTAGRAM", confidence: 0.8 };
    else if (name === "conversation_summary") json = { summary: "Prospect asked for the catalog", stage: "INTERESTED", nextAction: { action: "send_catalog", when: "now", reason: "asked" }, confidence: 0.9 };
    else json = {};
    return { text: JSON.stringify(json), json, usage: { inputTokens: 100, outputTokens: 50 }, model: this.model, provider: this.key, durationMs: 5 };
  }
}

const fakeProvider = (results: DiscoveryResult[]): DiscoveryProvider => ({
  key: "fake:instagram",
  platform: "INSTAGRAM",
  strategy: "profile_search",
  priority: 1,
  supports: () => true,
  search: async () => ({ results, runs: [{ provider: "fake", actorId: "fake/actor", adapter: "test", purpose: "DISCOVERY", status: "SUCCEEDED", input: {}, itemCount: results.length, startedAt: new Date(), finishedAt: new Date() }], warnings: [] }),
});

const source = { provider: "fake", actorId: "fake/actor", adapter: "test", fetchedAt: new Date() };
const ig = (username: string, extra: Partial<DiscoveryResult> = {}): DiscoveryResult => ({ platform: "INSTAGRAM", username, profileUrl: `https://www.instagram.com/${username}/`, raw: { username }, source, ...extra });

d("MVP workflow", () => {
  let db: PrismaClient;
  let organizationId: string;
  let userId: string;
  const ai = new FakeAI();

  beforeAll(async () => {
    db = getDb();
    const stamp = Date.now().toString(36);
    const user = await db.user.create({ data: { email: `owner-${stamp}@test.local`, name: "Owner", passwordHash: await hashPassword("Secret123!") } });
    const org = await db.organization.create({ data: { name: `Test Exporter ${stamp}`, slug: `test-${stamp}`, products: "Custom sportswear, hoodies, leggings", moq: "500 units per style", timezone: "Asia/Karachi" } });
    await db.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "OWNER" } });
    await db.organizationSettings.create({ data: { organizationId: org.id, followUpDays: [3, 7] } });
    organizationId = org.id;
    userId = user.id;
    setAIProviderForTests(ai);
    setProfileProvidersForTests([]);
  });

  afterAll(async () => {
    setAIProviderForTests(undefined);
    setDiscoveryProvidersForTests(undefined);
    setProfileProvidersForTests(undefined);
    await db.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    await disconnectDb();
  });

  let searchRunId: string;
  let leadIds: string[] = [];
  let clientId = "";
  let cid = "";
  let conversationId = "";

  it("discovers, normalizes and de-duplicates leads for a search", async () => {
    setDiscoveryProvidersForTests([
      fakeProvider([
        ig("urbanfit", { displayName: "Urban Fit", followers: 12000, bio: "Performance apparel for runners in NYC. hello@urbanfit.com", website: "https://urbanfit.com", isBusiness: true }),
        ig("urbanfit", { followers: 12000 }), // duplicate account in the same batch
        ig("tinybrand", { followers: 800 }), // below the follower range
        ig("nova.athletics", { displayName: "Nova Athletics", followers: 45000, website: "https://novaathletics.com" }),
      ]),
    ]);
    const { run } = await createSearchRun(db, { organizationId, userId }, { query: "New apparel brands in New York", keywords: [], platform: "INSTAGRAM", minFollowers: 5000, maxFollowers: 100000, limit: 10, strategy: "auto", filters: {}, enrich: false });
    searchRunId = run.id;
    const result = await executeSearchRun(db, run.id);
    expect(result.run.status).toBe("COMPLETED");
    expect(result.run.totalRaw).toBe(4);
    expect(result.persisted.created).toBe(2);
    const page = await listLeads(db, { organizationId }, { page: 1, pageSize: 25, sort: "score", order: "desc", searchRunId });
    leadIds = page.items.map((l) => l.id);
    expect(page.items.map((l) => l.username).sort()).toEqual(["nova.athletics", "urbanfit"]);
    const urban = page.items.find((l) => l.username === "urbanfit")!;
    expect(urban.email).toBe("hello@urbanfit.com");
    expect(urban.websiteDomain).toBe("urbanfit.com");
    expect(urban.city).toBeNull(); // never invented from the search location
  });

  it("matches an already known lead on a second search instead of duplicating it", async () => {
    setDiscoveryProvidersForTests([fakeProvider([ig("urbanfit", { followers: 13000 }), ig("freshlabel", { followers: 7000 })])]);
    const { run } = await createSearchRun(db, { organizationId, userId }, { query: "activewear brands", keywords: [], platform: "INSTAGRAM", limit: 10, strategy: "auto", filters: {}, enrich: false });
    const result = await executeSearchRun(db, run.id);
    expect(result.persisted.created).toBe(1);
    expect(result.persisted.matched).toBe(1);
    expect(await db.lead.count({ where: { organizationId, username: "urbanfit" } })).toBe(1);
  });

  it("saves leads and adds them to business with sequential CIDs, without duplicates", async () => {
    expect(await setLeadsSaved(db, { organizationId, userId }, leadIds, true)).toBe(2);
    const first = await addLeadsToBusinessCompat(db, { organizationId, userId }, leadIds);
    expect(first.created.map((c) => c.cid).sort()).toEqual(["CX-000001", "CX-000002"]);
    const again = await addLeadsToBusinessCompat(db, { organizationId, userId }, leadIds);
    expect(again.created).toHaveLength(0);
    expect(again.existing).toHaveLength(2);
    const urbanLead = await db.lead.findFirstOrThrow({ where: { organizationId, username: "urbanfit" }, include: { client: true } });
    clientId = urbanLead.client!.id;
    cid = urbanLead.client!.cid;
    const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, include: { socialAccounts: true, contacts: true } });
    expect(client.timezone).toBeNull(); // no location known for this lead
    expect(client.socialAccounts[0]).toMatchObject({ platform: "INSTAGRAM", username: "urbanfit", messagingEligibility: "DISCOVERED" });
    expect(client.contacts.some((c) => c.type === "EMAIL" && c.source === "INSTAGRAM_BIO")).toBe(true);
  });

  it("allocates CIDs atomically under concurrency", async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => db.$transaction((tx) => allocateClientCid(tx, organizationId))));
    const sequences = results.map((r) => r.sequence);
    expect(new Set(sequences).size).toBe(8);
    expect(Math.min(...sequences)).toBe(3);
  });

  it("generates a personalized, rule-checked first message and logs the AI action", async () => {
    const client = await db.client.findUniqueOrThrow({ where: { id: clientId }, include: { socialAccounts: true, tags: { include: { tag: true } }, notes: true } });
    const outcome = await generateFirstMessage({ db, organizationId, triggeredBy: "USER", userId, clientId }, { client: { cid: client.cid, brandName: client.brandName, bio: client.bio, followers: client.followers, platform: "INSTAGRAM", username: "urbanfit" }, channel: "INSTAGRAM" });
    expect(outcome.result.message).toContain("Urban Fit");
    expect(outcome.result.validation.ok).toBe(true);
    const log = await db.aIActionLog.findUniqueOrThrow({ where: { id: outcome.actionLogId } });
    expect(log).toMatchObject({ action: "GENERATE_FIRST_MESSAGE", status: "SUCCESS", provider: "fake", tokensIn: 100 });
    const system = ai.calls.at(-1)!.system;
    expect(system).toContain("MOQ: 500 units per style");
    expect(system).toContain("Never invent facts");
  });

  it("sends manually when no automation provider is available and shows why", async () => {
    const account = await db.clientSocialAccount.findFirstOrThrow({ where: { clientId } });
    const decision = await resolveMessagingProvider(db, organizationId, targetFromSocialAccount(account));
    expect(decision.provider).toBeNull();
    expect(decision.considered.map((c) => c.providerKey)).toEqual(["meta_instagram", "extension", "apify", "manual"]);
    const auto = await createOutboundMessage(db, { organizationId, userId }, { clientId, channel: "INSTAGRAM", body: "Automated attempt", delivery: "automation" });
    expect(auto.message.status).toBe("UNAVAILABLE");
    expect(auto.openUrl).toBe("https://www.instagram.com/direct/new/");
    const manual = await createOutboundMessage(db, { organizationId, userId }, { clientId, channel: "INSTAGRAM", body: "Hi Urban Fit, quick question about your next drop.", delivery: "manual" });
    expect(manual.message.status).toBe("SENT");
    conversationId = manual.conversationId;
    const inbox = await listConversations(db, { organizationId }, { page: 1, pageSize: 10 });
    expect(inbox.items.map((c) => c.id)).toContain(conversationId);
    const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
    expect(client.status).toBe("CONTACTED");
    expect(client.lastContactedAt).not.toBeNull();
  });

  it("queues through the browser extension when a device is online, and cancels cleanly", async () => {
    const device = await db.extensionDevice.create({ data: { organizationId, userId, name: "Test Chrome", status: "ONLINE", lastSeenAt: new Date() } });
    const res = await createOutboundMessage(db, { organizationId, userId }, { clientId, channel: "INSTAGRAM", body: "Queued via extension", delivery: "automation" });
    expect(res.message.status).toBe("QUEUED");
    expect(res.send?.providerKey).toBe("extension");
    expect(res.job?.provider).toBe("EXTENSION");
    await db.messageJob.update({ where: { id: res.job!.id }, data: { status: "CANCELLED" } });
    await db.message.update({ where: { id: res.message.id }, data: { status: "CANCELLED" } });
    await db.extensionDevice.delete({ where: { id: device.id } });
  });

  it("classifies an inbound reply and parks the AI answer for approval in copilot mode", async () => {
    await db.organizationSettings.update({ where: { organizationId }, data: { messagingMode: "COPILOT" } });
    await logManualMessage(db, { organizationId, userId }, { conversationId, direction: "INBOUND", body: "Yes please send me your catalog" });
    const queue = new MysqlJobQueue(db);
    const job = await queue.enqueue({ type: "AI_REPLY_JOB", organizationId, payload: { conversationId } });
    const out = await handleAiReplyJob({ db, queue, job, organizationId, payload: { conversationId }, log: console as never });
    expect(out.intent).toBe("CATALOG_REQUEST");
    expect(out.action).toBe("pending_approval");
    const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv.lastIntent).toBe("CATALOG_REQUEST");
    expect(conv.aiStatus).toBe("suggestion_ready");
    const pending = await db.message.findFirst({ where: { conversationId, status: "PENDING_APPROVAL" } });
    expect(pending?.aiGenerated).toBe(true);
    const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
    expect(client.status).toBe("INTERESTED");
  });

  it("respects do-not-contact and rate limits", async () => {
    await db.client.update({ where: { id: clientId }, data: { doNotContact: true } });
    await expect(createOutboundMessage(db, { organizationId, userId }, { clientId, channel: "INSTAGRAM", body: "x", delivery: "manual" })).rejects.toMatchObject({ code: "CONFLICT" });
    await db.client.update({ where: { id: clientId }, data: { doNotContact: false } });
    await db.organizationSettings.update({ where: { organizationId }, data: { messagesPerHour: 1 } });
    await expect(createOutboundMessage(db, { organizationId, userId }, { clientId, channel: "INSTAGRAM", body: "x", delivery: "manual" })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await db.organizationSettings.update({ where: { organizationId }, data: { messagesPerHour: 20 } });
  });

  it("processes Meta webhook events idempotently and creates clients for unknown senders", async () => {
    const connection = await db.socialConnection.create({ data: { organizationId, platform: "INSTAGRAM", provider: "meta", externalAccountId: "1789000", pageId: "9900", displayName: "ABC Sportswear IG", status: "CONNECTED", accessTokenEncrypted: encryptSecret("page-token", process.env.ENCRYPTION_KEY) } });
    const event = { object: "instagram", entry: [{ id: "1789000", time: Date.now(), messaging: [{ sender: { id: "sender-555" }, recipient: { id: "1789000" }, timestamp: Date.now(), message: { mid: `mid-${Date.now()}`, text: "Hello from a new brand" } }] }] };
    const first = await processMetaWebhook(db, event);
    expect(first.inboundMessages).toBe(1);
    expect(first.inboundConversationIds).toHaveLength(1);
    const second = await processMetaWebhook(db, event);
    expect(second.duplicates).toBe(1);
    expect(second.inboundMessages).toBe(0);
    const account = await db.clientSocialAccount.findFirstOrThrow({ where: { organizationId, scopedUserId: "sender-555" }, include: { client: true } });
    expect(account.messagingEligibility).toBe("MESSAGEABLE");
    expect(account.client.cid).toMatch(/^CX-\d{6}$/);
    const decision = await resolveMessagingProvider(db, organizationId, { ...targetFromSocialAccount(account, connection.id), socialConnectionId: connection.id });
    expect(decision.providerKey).toBe("meta_instagram");
    expect(decision.capability.canSend).toBe(true);
  });

  it("fails jobs gracefully when the AI provider is unavailable", async () => {
    setAIProviderForTests(null);
    await db.organizationSettings.update({ where: { organizationId }, data: { messagingMode: "AUTOPILOT", autopilotEnabled: true, autoReply: true } });
    await logManualMessage(db, { organizationId, userId }, { conversationId, direction: "INBOUND", body: "What is your MOQ for leggings?" });
    const queue = new MysqlJobQueue(db);
    const job = await queue.enqueue({ type: "AI_REPLY_JOB", organizationId, payload: { conversationId } });
    const runner = createRunner(db, queue, "test-runner");
    const outcome = await runner.runJob(job);
    expect(outcome).toBe("failed");
    const stored = await db.automationJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(stored.status).toBe("FAILED");
    expect(stored.error).toContain("AI is not configured");
    const conv = await db.conversation.findUniqueOrThrow({ where: { id: conversationId } });
    expect(conv.needsHumanReview).toBe(true);
    setAIProviderForTests(ai);
  });

  it("scheduler enqueues due scheduled messages with dedupe keys", async () => {
    const scheduled = await db.scheduledMessage.create({ data: { organizationId, clientId, conversationId, channel: "INSTAGRAM", body: "Follow-up", scheduledAt: new Date(Date.now() - 1000), timezone: "UTC", status: "SCHEDULED", createdByType: "USER" } });
    const queue = getJobQueue(db);
    const summary1 = await runSchedulerTick(db, queue);
    expect(summary1.scheduledMessagesQueued).toBeGreaterThanOrEqual(1);
    const summary2 = await runSchedulerTick(db, queue);
    expect(summary2.scheduledMessagesQueued).toBe(0);
    const row = await db.scheduledMessage.findUniqueOrThrow({ where: { id: scheduled.id } });
    expect(row.status).toBe("QUEUED");
    expect(await db.automationJob.count({ where: { dedupeKey: `scheduled:${scheduled.id}` } })).toBe(1);
    const policy = await loadPolicy(db, organizationId);
    expect(policy.followUpDays).toEqual([3, 7]);
  });
});
