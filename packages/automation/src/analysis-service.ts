import { buildSystemPrompt, loadCompanyContext, requireAIProvider } from "@oses/ai";
import type { DbClient } from "@oses/database";
import { writeAudit } from "@oses/database";
import { resolveProviders, type ContentCriteria, type ContentResult } from "@oses/discovery";
import { createLogger, errorMessage, normalizeCountryCode, normalizeText, NotFoundError, type Platform } from "@oses/shared";
import type { CompetitorSearchInput, TrendSearchInput } from "@oses/validation";
import { z } from "zod";
import type { JobQueue } from "./queue";

const log = createLogger("automation.analysis");

export interface AnalysisContext {
  organizationId: string;
  userId?: string | null;
}

export async function createCompetitorSearch(db: DbClient, ctx: AnalysisContext, queue: JobQueue, input: CompetitorSearchInput) {
  const row = await db.competitorSearch.create({ data: { organizationId: ctx.organizationId, name: input.name ?? `${input.keywords.join(", ")}${input.city || input.country ? ` in ${[input.city, input.country].filter(Boolean).join(", ")}` : ""}`.slice(0, 140), criteria: input as object, status: "QUEUED", createdByUserId: ctx.userId ?? null } });
  const job = await queue.enqueue({ type: "COMPETITOR_ANALYSIS_JOB", organizationId: ctx.organizationId, payload: { competitorSearchId: row.id }, entityType: "CompetitorSearch", entityId: row.id });
  await db.competitorSearch.update({ where: { id: row.id }, data: { jobId: job.id } });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "competitor_search.started", entityType: "CompetitorSearch", entityId: row.id });
  return row;
}

export async function createTrendSearch(db: DbClient, ctx: AnalysisContext, queue: JobQueue, input: TrendSearchInput) {
  const row = await db.trendSearch.create({ data: { organizationId: ctx.organizationId, name: input.name ?? `${[input.productCategory, ...input.keywords, ...input.hashtags.map((h) => `#${h}`)].filter(Boolean).join(", ")}`.slice(0, 140), criteria: input as object, status: "QUEUED", createdByUserId: ctx.userId ?? null } });
  const job = await queue.enqueue({ type: "TREND_ANALYSIS_JOB", organizationId: ctx.organizationId, payload: { trendSearchId: row.id }, entityType: "TrendSearch", entityId: row.id });
  await db.trendSearch.update({ where: { id: row.id }, data: { jobId: job.id } });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "trend_search.started", entityType: "TrendSearch", entityId: row.id });
  return row;
}

function toContentCriteria(input: { platform: "INSTAGRAM" | "FACEBOOK" | "BOTH"; keywords: string[]; hashtags?: string[]; country?: string | null; city?: string | null; limit: number; dateFrom?: string | null; dateTo?: string | null }, platform: Platform): ContentCriteria {
  const hashtags = (input.hashtags?.length ? input.hashtags : input.keywords.map((k) => normalizeText(k).replace(/\s+/g, ""))).filter((h) => h.length >= 3).slice(0, 6);
  return {
    platform,
    keywords: input.keywords.map((k) => normalizeText(k)).filter(Boolean),
    hashtags,
    location: { country: input.country ?? null, countryCode: normalizeCountryCode(input.country), region: null, city: input.city ?? null },
    limit: input.limit,
    dateFrom: input.dateFrom ? new Date(input.dateFrom) : null,
    dateTo: input.dateTo ? new Date(input.dateTo) : null,
  };
}

async function collectContent(db: DbClient, organizationId: string, input: Parameters<typeof toContentCriteria>[0]): Promise<{ items: ContentResult[]; warnings: string[] }> {
  const resolved = await resolveProviders(db, organizationId);
  const warnings = [...resolved.warnings];
  const items: ContentResult[] = [];
  const platforms: Platform[] = input.platform === "BOTH" ? ["INSTAGRAM", "FACEBOOK"] : [input.platform];
  for (const platform of platforms) {
    const provider = resolved.content.find((p) => p.platform === platform);
    if (!provider) {
      warnings.push(`No content provider configured for ${platform}`);
      continue;
    }
    const batch = await provider.fetchContent(toContentCriteria(input, platform), { organizationId });
    items.push(...batch.results);
    warnings.push(...batch.warnings);
  }
  return { items, warnings };
}

async function storeContent(db: DbClient, organizationId: string, items: ContentResult[], link: { competitorSearchId?: string; trendSearchId?: string }): Promise<number> {
  let stored = 0;
  for (const item of items) {
    await db.contentItem.create({
      data: {
        organizationId,
        competitorSearchId: link.competitorSearchId ?? null,
        trendSearchId: link.trendSearchId ?? null,
        platform: item.platform,
        accountUsername: item.accountUsername,
        accountName: item.accountName,
        accountUrl: item.accountUrl,
        postUrl: item.postUrl,
        externalId: item.externalId,
        postedAt: item.postedAt,
        caption: item.caption,
        hashtags: item.hashtags as unknown as object,
        likes: item.likes,
        comments: item.comments,
        views: item.views,
        mediaType: item.mediaType,
        location: item.location,
        raw: item.raw as object,
      },
    });
    stored++;
  }
  return stored;
}

/** Deterministic statistics computed from observed data (kept separate from AI interpretation). */
export function summarizeContent(items: ContentResult[]) {
  const hashtagCounts = new Map<string, number>();
  const wordCounts = new Map<string, number>();
  const accounts = new Map<string, { username: string; name: string | null; posts: number; likes: number; comments: number; url: string | null }>();
  const stop = new Set(["the", "and", "for", "with", "you", "your", "our", "this", "that", "are", "from", "new", "now", "all", "get", "out", "have", "has", "was", "not", "but", "can", "its", "one", "just", "more", "shop", "link", "bio"]);
  const colors = ["black", "white", "red", "blue", "green", "grey", "gray", "navy", "beige", "brown", "pink", "purple", "orange", "yellow", "olive", "cream", "khaki", "burgundy", "teal"];
  const colorCounts = new Map<string, number>();
  let totalLikes = 0;
  let totalComments = 0;
  for (const it of items) {
    for (const h of it.hashtags) hashtagCounts.set(h, (hashtagCounts.get(h) ?? 0) + 1);
    for (const w of normalizeText(it.caption).split(" ")) {
      if (w.length < 4 || stop.has(w)) continue;
      wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
      if (colors.includes(w)) colorCounts.set(w, (colorCounts.get(w) ?? 0) + 1);
    }
    totalLikes += it.likes ?? 0;
    totalComments += it.comments ?? 0;
    if (it.accountUsername) {
      const a = accounts.get(it.accountUsername) ?? { username: it.accountUsername, name: it.accountName, posts: 0, likes: 0, comments: 0, url: it.accountUrl };
      a.posts++;
      a.likes += it.likes ?? 0;
      a.comments += it.comments ?? 0;
      accounts.set(it.accountUsername, a);
    }
  }
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
  const dates = items.map((i) => i.postedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => a.getTime() - b.getTime());
  return {
    posts: items.length,
    accounts: accounts.size,
    avgLikes: items.length ? Math.round(totalLikes / items.length) : 0,
    avgComments: items.length ? Math.round(totalComments / items.length) : 0,
    topHashtags: top(hashtagCounts, 25),
    topKeywords: top(wordCounts, 25),
    colorMentions: top(colorCounts, 10),
    topAccounts: [...accounts.values()].sort((a, b) => b.likes - a.likes).slice(0, 20),
    dateRange: dates.length ? { from: dates[0]!.toISOString(), to: dates[dates.length - 1]!.toISOString() } : null,
  };
}

const reportSchema = z.object({
  headline: z.string(),
  observedData: z.array(z.string()).describe("Statements that are directly supported by the collected posts/statistics"),
  interpretation: z.array(z.string()).describe("AI interpretation and hypotheses, clearly speculative"),
  productOpportunities: z.array(z.string()),
  recommendedActions: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

async function generateReport(db: DbClient, organizationId: string, kind: "competitor" | "trend", criteria: unknown, stats: ReturnType<typeof summarizeContent>, samples: ContentResult[]): Promise<string | null> {
  try {
    const { provider } = await requireAIProvider(db, organizationId);
    const company = await loadCompanyContext(db, organizationId);
    const system = buildSystemPrompt(`Write a ${kind} analysis for the exporter's sales team. Separate OBSERVED DATA (facts from the statistics and post samples) from INTERPRETATION (your reading of them). Never present scraped or inferred information as guaranteed fact.`, { company });
    const user = `CRITERIA: ${JSON.stringify(criteria)}\n\nSTATISTICS (computed from ${stats.posts} posts):\n${JSON.stringify(stats, null, 1)}\n\nPOST SAMPLES:\n${samples
      .slice(0, 40)
      .map((s) => `- @${s.accountUsername ?? "?"} (${s.likes ?? "?"} likes, ${s.comments ?? "?"} comments)${s.postedAt ? ` ${s.postedAt.toISOString().slice(0, 10)}` : ""}: ${(s.caption ?? "").replace(/\s+/g, " ").slice(0, 220)}`)
      .join("\n")}\n\nReturn the JSON object.`;
    const result = await provider.generate({ system, messages: [{ role: "user", content: user }], jsonSchema: { name: "analysis_report", schema: reportSchema }, effort: "medium", maxTokens: 3000, purpose: `${kind}_analysis` });
    const data = result.json as z.infer<typeof reportSchema>;
    await db.aIActionLog.create({ data: { organizationId, action: kind === "competitor" ? "COMPETITOR_ANALYSIS" : "TREND_ANALYSIS", status: "SUCCESS", triggeredBy: "SYSTEM", provider: result.provider, model: result.model, inputContext: { posts: stats.posts } as object, output: data as object, confidence: data.confidence, tokensIn: result.usage.inputTokens, tokensOut: result.usage.outputTokens, durationMs: result.durationMs } });
    const section = (title: string, lines: string[]) => (lines.length ? `## ${title}\n${lines.map((l) => `- ${l}`).join("\n")}` : "");
    return [`# ${data.headline}`, section("Observed data", data.observedData), section("AI interpretation (not verified)", data.interpretation), section("Product opportunities", data.productOpportunities), section("Recommended actions", data.recommendedActions), `_AI confidence: ${Math.round(data.confidence * 100)}%. Interpretation sections are generated by AI from public content and may be wrong._`].filter(Boolean).join("\n\n");
  } catch (err) {
    log.warn("AI report unavailable", { kind, error: errorMessage(err) });
    return null;
  }
}

export async function runCompetitorAnalysis(db: DbClient, competitorSearchId: string): Promise<Record<string, unknown>> {
  const row = await db.competitorSearch.findUnique({ where: { id: competitorSearchId } });
  if (!row) throw new NotFoundError("Competitor search");
  const criteria = row.criteria as unknown as CompetitorSearchInput;
  await db.competitorSearch.update({ where: { id: row.id }, data: { status: "RUNNING", error: null } });
  try {
    const { items, warnings } = await collectContent(db, row.organizationId, { platform: criteria.platform, keywords: criteria.keywords, country: criteria.country, city: criteria.city, limit: criteria.limit, dateFrom: criteria.dateFrom, dateTo: criteria.dateTo });
    await db.contentItem.deleteMany({ where: { competitorSearchId: row.id } });
    const stored = await storeContent(db, row.organizationId, items, { competitorSearchId: row.id });
    const stats = summarizeContent(items);
    const report = items.length ? await generateReport(db, row.organizationId, "competitor", criteria, stats, items) : null;
    await db.competitorSearch.update({ where: { id: row.id }, data: { status: items.length || !warnings.length ? "COMPLETED" : "FAILED", itemCount: stored, resultSummary: { ...stats, warnings } as object, aiReport: report, error: items.length ? null : warnings.join("\n").slice(0, 2000) || "No content collected" } });
    return { items: stored, warnings };
  } catch (err) {
    await db.competitorSearch.update({ where: { id: row.id }, data: { status: "FAILED", error: errorMessage(err).slice(0, 2000) } });
    throw err;
  }
}

export async function runTrendAnalysis(db: DbClient, trendSearchId: string): Promise<Record<string, unknown>> {
  const row = await db.trendSearch.findUnique({ where: { id: trendSearchId } });
  if (!row) throw new NotFoundError("Trend search");
  const criteria = row.criteria as unknown as TrendSearchInput;
  await db.trendSearch.update({ where: { id: row.id }, data: { status: "RUNNING", error: null } });
  try {
    const keywords = [...(criteria.productCategory ? [criteria.productCategory] : []), ...criteria.keywords];
    const { items, warnings } = await collectContent(db, row.organizationId, { platform: criteria.platform, keywords, hashtags: criteria.hashtags, country: criteria.country, city: criteria.city, limit: criteria.limit, dateFrom: criteria.dateFrom, dateTo: criteria.dateTo });
    await db.contentItem.deleteMany({ where: { trendSearchId: row.id } });
    const stored = await storeContent(db, row.organizationId, items, { trendSearchId: row.id });
    const stats = summarizeContent(items);
    const report = items.length ? await generateReport(db, row.organizationId, "trend", criteria, stats, items) : null;
    await db.trendSearch.update({ where: { id: row.id }, data: { status: items.length || !warnings.length ? "COMPLETED" : "FAILED", itemCount: stored, resultSummary: { ...stats, warnings } as object, aiReport: report, error: items.length ? null : warnings.join("\n").slice(0, 2000) || "No content collected" } });
    return { items: stored, warnings };
  } catch (err) {
    await db.trendSearch.update({ where: { id: row.id }, data: { status: "FAILED", error: errorMessage(err).slice(0, 2000) } });
    throw err;
  }
}
