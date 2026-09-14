import type { Campaign, DbClient, Prisma } from "@oses/database";
import { allocateClientCid, writeAudit } from "@oses/database";
import { ConflictError, NotFoundError, normalizePage, paginate, type Paginated } from "@oses/shared";
import type { CreateCampaignInput } from "@oses/validation";
import { isContactable } from "./autopilot";
import type { JobQueue } from "./queue";

export interface CampaignContext {
  organizationId: string;
  userId?: string | null;
}

export async function createCampaign(db: DbClient, ctx: CampaignContext, input: CreateCampaignInput): Promise<Campaign> {
  const campaign = await db.campaign.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name,
      channel: input.channel,
      audienceType: input.audienceType,
      audienceFilter: input.audienceFilter as object,
      firstMessageMode: input.firstMessageMode,
      template: input.template ?? null,
      followUps: input.followUps as object,
      workingHours: input.workingHours as object,
      timezoneMode: input.timezoneMode,
      customTimezone: input.customTimezone ?? null,
      messagesPerDay: input.messagesPerDay,
      requireApproval: input.requireApproval,
      startAt: input.startAt ? new Date(input.startAt) : null,
      createdByUserId: ctx.userId ?? null,
      status: "DRAFT",
    },
  });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "campaign.created", entityType: "Campaign", entityId: campaign.id, meta: { name: input.name } });
  return campaign;
}

export async function updateCampaign(db: DbClient, ctx: CampaignContext, id: string, input: Partial<CreateCampaignInput>): Promise<Campaign> {
  const existing = await db.campaign.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!existing) throw new NotFoundError("Campaign");
  if (existing.status === "RUNNING") throw new ConflictError("Pause the campaign before editing it");
  const data: Prisma.CampaignUncheckedUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.channel) data.channel = input.channel;
  if (input.audienceType) data.audienceType = input.audienceType;
  if (input.audienceFilter) data.audienceFilter = input.audienceFilter as object;
  if (input.firstMessageMode) data.firstMessageMode = input.firstMessageMode;
  if (input.template !== undefined) data.template = input.template ?? null;
  if (input.followUps) data.followUps = input.followUps as object;
  if (input.workingHours) data.workingHours = input.workingHours as object;
  if (input.timezoneMode) data.timezoneMode = input.timezoneMode;
  if (input.customTimezone !== undefined) data.customTimezone = input.customTimezone ?? null;
  if (input.messagesPerDay) data.messagesPerDay = input.messagesPerDay;
  if (input.requireApproval !== undefined) data.requireApproval = input.requireApproval;
  if (input.startAt !== undefined) data.startAt = input.startAt ? new Date(input.startAt) : null;
  return db.campaign.update({ where: { id }, data });
}

/** Resolve the audience into CampaignLead rows (clients only; saved leads are converted to clients first). */
export async function materializeAudience(db: DbClient, ctx: CampaignContext, campaign: Campaign): Promise<{ added: number; skipped: number }> {
  const filter = (campaign.audienceFilter as { clientIds?: string[]; leadIds?: string[]; tag?: string; country?: string; status?: string } | null) ?? {};
  let clientIds: string[] = [];
  if (campaign.audienceType === "CLIENTS") {
    const where: Prisma.ClientWhereInput = { organizationId: ctx.organizationId, deletedAt: null, doNotContact: false };
    if (filter.clientIds?.length) where.id = { in: filter.clientIds };
    if (filter.tag) where.tags = { some: { tag: { name: filter.tag } } };
    if (filter.country) where.country = { contains: filter.country };
    if (filter.status) where.status = filter.status as never;
    clientIds = (await db.client.findMany({ where, select: { id: true }, take: 2000 })).map((c) => c.id);
  } else if (campaign.audienceType === "TAG" && filter.tag) {
    clientIds = (await db.client.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null, doNotContact: false, tags: { some: { tag: { name: filter.tag } } } }, select: { id: true }, take: 2000 })).map((c) => c.id);
  } else if (campaign.audienceType === "SAVED_LEADS") {
    const leads = await db.lead.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null, ...(filter.leadIds?.length ? { id: { in: filter.leadIds } } : { isSaved: true }) }, include: { socialAccounts: true }, take: 2000 });
    for (const lead of leads) {
      if (lead.clientId) {
        clientIds.push(lead.clientId);
        continue;
      }
      // Convert the saved lead into a client (same rules as "Add to Business").
      const client = await db.$transaction(async (tx) => {
        const { cid, sequence } = await allocateClientCid(tx, ctx.organizationId);
        const created = await tx.client.create({ data: { organizationId: ctx.organizationId, cid, cidSequence: sequence, brandName: lead.brandName, companyName: lead.name, category: lead.category, website: lead.website, websiteDomain: lead.websiteDomain, email: lead.email, phone: lead.phone, whatsapp: lead.whatsapp, country: lead.country, region: lead.region, city: lead.city, address: lead.address, timezone: lead.timezone, followers: lead.followers, bio: lead.bio, source: lead.source, leadScore: lead.leadScore, createdByUserId: ctx.userId ?? null } });
        await tx.lead.update({ where: { id: lead.id }, data: { clientId: created.id, status: "ADDED" } });
        for (const a of lead.socialAccounts) {
          await tx.clientSocialAccount.create({ data: { organizationId: ctx.organizationId, clientId: created.id, platform: a.platform, username: a.username, profileUrl: a.profileUrl, externalId: a.externalId, inboxUrl: a.inboxUrl, displayName: a.displayName, followers: a.followers, following: a.following, postsCount: a.postsCount, bio: a.bio, category: a.category, isBusiness: a.isBusiness, isVerified: a.isVerified, isPrivate: a.isPrivate, raw: a.raw ?? undefined, sourceProvider: a.sourceProvider } }).catch(() => undefined);
        }
        return created;
      });
      clientIds.push(client.id);
    }
  }
  let added = 0;
  let skipped = 0;
  for (const clientId of [...new Set(clientIds)]) {
    const hasAccount = await db.clientSocialAccount.count({ where: { clientId, platform: campaign.channel } });
    if (!hasAccount) {
      skipped++;
      continue;
    }
    const res = await db.campaignLead.upsert({ where: { campaignId_clientId: { campaignId: campaign.id, clientId } }, create: { campaignId: campaign.id, clientId, status: "PENDING" }, update: {} });
    if (res) added++;
  }
  return { added, skipped };
}

export async function changeCampaignStatus(db: DbClient, ctx: CampaignContext, queue: JobQueue, id: string, action: "start" | "pause" | "resume" | "cancel" | "complete"): Promise<Campaign> {
  const campaign = await db.campaign.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!campaign) throw new NotFoundError("Campaign");
  const now = new Date();
  let data: Prisma.CampaignUncheckedUpdateInput;
  switch (action) {
    case "start": {
      if (!["DRAFT", "SCHEDULED", "PAUSED"].includes(campaign.status)) throw new ConflictError(`Campaign cannot start from ${campaign.status}`);
      const audience = await materializeAudience(db, ctx, campaign);
      const scheduled = campaign.startAt && campaign.startAt > now;
      data = { status: scheduled ? "SCHEDULED" : "RUNNING", startedAt: scheduled ? null : now, pausedAt: null, stats: { ...(campaign.stats as object), audience } as object };
      break;
    }
    case "pause":
      if (campaign.status !== "RUNNING") throw new ConflictError("Only running campaigns can be paused");
      data = { status: "PAUSED", pausedAt: now };
      break;
    case "resume":
      if (campaign.status !== "PAUSED") throw new ConflictError("Only paused campaigns can be resumed");
      data = { status: "RUNNING", pausedAt: null };
      break;
    case "cancel":
      data = { status: "CANCELLED", completedAt: now };
      await db.scheduledMessage.updateMany({ where: { campaignId: id, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, data: { status: "CANCELLED", cancelledAt: now } });
      await db.campaignLead.updateMany({ where: { campaignId: id, status: { in: ["PENDING", "SCHEDULED", "CONTACTED"] } }, data: { status: "STOPPED", stopReason: "campaign cancelled" } });
      break;
    case "complete":
      data = { status: "COMPLETED", completedAt: now };
      break;
  }
  const updated = await db.campaign.update({ where: { id }, data });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: `campaign.${action === "start" || action === "resume" ? "started" : action === "pause" ? "paused" : action + "d"}`, entityType: "Campaign", entityId: id });
  if (updated.status === "RUNNING") await queue.enqueue({ type: "CAMPAIGN_STEP_JOB", organizationId: ctx.organizationId, payload: { campaignId: id }, dedupeKey: `campaign-step:${id}`, entityType: "Campaign", entityId: id });
  return updated;
}

/** One campaign tick: contact pending leads within the daily limit; follow-ups are driven by FOLLOWUP_JOBs. */
export async function processCampaignStep(db: DbClient, queue: JobQueue, campaignId: string): Promise<Record<string, unknown>> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "RUNNING") return { skipped: campaign?.status ?? "missing" };
  const dayAgo = new Date(Date.now() - 86_400_000);
  const sentToday = await db.message.count({ where: { campaignId, direction: "OUTBOUND", createdAt: { gte: dayAgo }, status: { notIn: ["CANCELLED", "FAILED"] } } });
  const budget = Math.max(0, campaign.messagesPerDay - sentToday);
  const pending = await db.campaignLead.findMany({ where: { campaignId, status: "PENDING" }, include: { client: true }, orderBy: { createdAt: "asc" }, take: budget });
  let queued = 0;
  for (const cl of pending) {
    if (!isContactable(cl.client)) {
      await db.campaignLead.update({ where: { id: cl.id }, data: { status: "STOPPED", stopReason: "not contactable" } });
      continue;
    }
    if (campaign.firstMessageMode === "TEMPLATE" && campaign.template) {
      await db.campaignLead.update({ where: { id: cl.id }, data: { status: "SCHEDULED" } });
      await queue.enqueue({ type: "AI_FIRST_MESSAGE_JOB", organizationId: campaign.organizationId, payload: { clientId: cl.clientId, channel: campaign.channel, campaignId, campaignLeadId: cl.id, template: campaign.template.replace(/\{\{\s*brand\s*\}\}/gi, cl.client.brandName) }, dedupeKey: `campaign-first:${campaignId}:${cl.clientId}`, entityType: "CampaignLead", entityId: cl.id });
    } else {
      await db.campaignLead.update({ where: { id: cl.id }, data: { status: "SCHEDULED" } });
      await queue.enqueue({ type: "AI_FIRST_MESSAGE_JOB", organizationId: campaign.organizationId, payload: { clientId: cl.clientId, channel: campaign.channel, campaignId, campaignLeadId: cl.id }, dedupeKey: `campaign-first:${campaignId}:${cl.clientId}`, entityType: "CampaignLead", entityId: cl.id });
    }
    queued++;
  }
  const remaining = await db.campaignLead.count({ where: { campaignId, status: { in: ["PENDING", "SCHEDULED", "CONTACTED"] } } });
  const counts = await db.campaignLead.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } });
  const stats = Object.fromEntries(counts.map((c) => [c.status.toLowerCase(), c._count._all]));
  await db.campaign.update({ where: { id: campaignId }, data: { stats: { ...(campaign.stats as object), ...stats, sentToday: sentToday + queued, lastTickAt: new Date().toISOString() } as object, ...(remaining === 0 && pending.length === 0 ? { status: "COMPLETED", completedAt: new Date() } : {}) } });
  return { queued, sentToday, remaining };
}

export async function listCampaigns(db: DbClient, ctx: CampaignContext, query: { page?: number; pageSize?: number; status?: string }): Promise<Paginated<Campaign & { _count: { leads: number } }>> {
  const page = normalizePage(query);
  const where: Prisma.CampaignWhereInput = { organizationId: ctx.organizationId, deletedAt: null, ...(query.status ? { status: query.status as never } : {}) };
  const [total, items] = await Promise.all([db.campaign.count({ where }), db.campaign.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page.page - 1) * page.pageSize, take: page.pageSize, include: { _count: { select: { leads: true } } } })]);
  return paginate(items, total, page);
}

export async function getCampaignDetail(db: DbClient, ctx: CampaignContext, id: string) {
  const campaign = await db.campaign.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null }, include: { leads: { include: { client: { select: { id: true, cid: true, brandName: true, status: true, country: true } } }, orderBy: { createdAt: "asc" }, take: 500 }, _count: { select: { leads: true, scheduledMessages: true } } } });
  if (!campaign) throw new NotFoundError("Campaign");
  const messageStats = await db.message.groupBy({ by: ["status"], where: { campaignId: id, direction: "OUTBOUND" }, _count: { _all: true } });
  const replies = await db.message.count({ where: { campaignId: id, direction: "INBOUND" } });
  return { ...campaign, messageStats: Object.fromEntries(messageStats.map((s) => [s.status, s._count._all])), replies };
}
