import type { Client, DbClient, Lead, Prisma } from "@oses/database";
import { allocateClientCid, markRestored, writeAudit } from "@oses/database";
import { fuzzyMatch } from "@oses/discovery";
import { brandKey, buildInboxUrl, buildProfileUrl, ConflictError, extractDomain, normalizeEmail, normalizePage, normalizePhone, normalizeUrl, normalizeUsername, NotFoundError, paginate, parseSocialUrl, resolveTimezone, type Paginated, type Platform } from "@oses/shared";
import type { ClientListQuery, CreateClientInput, UpdateClientInput } from "@oses/validation";

export interface CrmContext {
  organizationId: string;
  userId?: string | null;
}

export interface AddToBusinessResult {
  created: Array<{ leadId: string; clientId: string; cid: string }>;
  existing: Array<{ leadId: string; clientId: string; cid: string; matchedBy: string }>;
  restored: Array<{ leadId: string; clientId: string; cid: string }>;
  skipped: Array<{ leadId: string; reason: string }>;
}

type LeadWithRelations = Prisma.LeadGetPayload<{ include: { socialAccounts: true; contacts: true; tags: { include: { tag: true } } } }>;

/** Find an existing client (including trashed ones) that matches a lead by deterministic identity, then fuzzy brand match. */
export async function findClientForLead(db: DbClient, organizationId: string, lead: LeadWithRelations): Promise<{ client: Client; matchedBy: string } | null> {
  const linked = lead.clientId ? await db.client.findFirst({ where: { id: lead.clientId, organizationId } }) : null;
  if (linked) return { client: linked, matchedBy: "lead-link" };
  const or: Prisma.ClientWhereInput[] = [];
  for (const a of lead.socialAccounts) {
    if (a.username) or.push({ socialAccounts: { some: { platform: a.platform, username: a.username } } });
    if (a.externalId) or.push({ socialAccounts: { some: { platform: a.platform, externalId: a.externalId } } });
  }
  if (lead.websiteDomain) or.push({ websiteDomain: lead.websiteDomain });
  if (lead.email) or.push({ email: lead.email }, { contacts: { some: { type: "EMAIL", normalizedValue: lead.email } } });
  if (lead.phone) or.push({ phone: lead.phone }, { contacts: { some: { type: "PHONE", normalizedValue: lead.phone } } });
  if (or.length) {
    const exact = await db.client.findFirst({ where: { organizationId, OR: or }, orderBy: { createdAt: "asc" } });
    if (exact) return { client: exact, matchedBy: exact.websiteDomain && exact.websiteDomain === lead.websiteDomain ? "website" : exact.email && exact.email === lead.email ? "email" : "social-account" };
  }
  const token = brandKey(lead.brandName).split(" ").find((t) => t.length >= 4);
  if (!token) return null;
  const candidates = await db.client.findMany({ where: { organizationId, brandName: { contains: token } }, take: 25 });
  for (const c of candidates) {
    const m = fuzzyMatch({ brandName: lead.brandName, username: lead.username, websiteDomain: lead.websiteDomain, email: lead.email, city: lead.city, country: lead.country }, { brandName: c.brandName, websiteDomain: c.websiteDomain, email: c.email, city: c.city, country: c.country });
    if (m.verdict === "duplicate") return { client: c, matchedBy: `fuzzy:${m.score.toFixed(2)}` };
  }
  return null;
}

async function copyLeadIntoClient(tx: DbClient, organizationId: string, clientId: string, lead: LeadWithRelations): Promise<void> {
  for (const a of lead.socialAccounts) {
    const exists = await tx.clientSocialAccount.findFirst({ where: { organizationId, platform: a.platform, OR: [{ username: a.username ?? "-" }, { externalId: a.externalId ?? "-" }] } });
    if (exists) continue;
    await tx.clientSocialAccount.create({
      data: { organizationId, clientId, platform: a.platform, username: a.username, profileUrl: a.profileUrl, externalId: a.externalId, inboxUrl: a.inboxUrl ?? buildInboxUrl(a.platform, { username: a.username, externalId: a.externalId }), externalThreadId: a.externalThreadId, displayName: a.displayName, followers: a.followers, following: a.following, postsCount: a.postsCount, bio: a.bio, category: a.category, isBusiness: a.isBusiness, isVerified: a.isVerified, isPrivate: a.isPrivate, raw: a.raw ?? undefined, sourceProvider: a.sourceProvider },
    });
  }
  for (const c of lead.contacts) {
    await tx.clientContact.upsert({
      where: { clientId_type_normalizedValue: { clientId, type: c.type, normalizedValue: c.normalizedValue } },
      create: { organizationId, clientId, type: c.type, value: c.value, normalizedValue: c.normalizedValue, source: c.source, sourceUrl: c.sourceUrl, confidence: c.confidence, label: c.label, isPrimary: c.isPrimary },
      update: {},
    });
  }
  for (const t of lead.tags) await tx.clientTag.upsert({ where: { clientId_tagId: { clientId, tagId: t.tagId } }, create: { clientId, tagId: t.tagId }, update: {} });
}

/**
 * "Add to Business": convert saved leads into permanent clients with a CID.
 * Never creates duplicates: matching clients are returned as `existing`; trashed matches are restored.
 */
export async function addLeadsToBusiness(db: DbClient, ctx: CrmContext, leadIds: string[]): Promise<AddToBusinessResult> {
  const result: AddToBusinessResult = { created: [], existing: [], restored: [], skipped: [] };
  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, organizationId: ctx.organizationId }, include: { socialAccounts: true, contacts: true, tags: { include: { tag: true } } } });
  for (const lead of leads) {
    if (lead.deletedAt) {
      result.skipped.push({ leadId: lead.id, reason: "lead is in the trash" });
      continue;
    }
    const match = await findClientForLead(db, ctx.organizationId, lead);
    if (match) {
      if (match.client.deletedAt) {
        await db.$transaction(async (tx) => {
          await tx.client.update({ where: { id: match.client.id }, data: { deletedAt: null } });
          await tx.lead.update({ where: { id: lead.id }, data: { clientId: match.client.id, status: "ADDED" } }).catch(() => undefined);
          await copyLeadIntoClient(tx, ctx.organizationId, match.client.id, lead);
        });
        await markRestored(db, "CLIENT", match.client.id);
        await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "client.restored", entityType: "Client", entityId: match.client.id, meta: { via: "add_to_business" } });
        result.restored.push({ leadId: lead.id, clientId: match.client.id, cid: match.client.cid });
      } else {
        if (!lead.clientId) await db.lead.update({ where: { id: lead.id }, data: { clientId: match.client.id, status: "ADDED" } }).catch(() => undefined);
        await db.$transaction((tx) => copyLeadIntoClient(tx, ctx.organizationId, match.client.id, lead));
        result.existing.push({ leadId: lead.id, clientId: match.client.id, cid: match.client.cid, matchedBy: match.matchedBy });
      }
      continue;
    }
    const tz = resolveTimezone({ country: lead.country, region: lead.region, city: lead.city });
    const client = await db.$transaction(async (tx) => {
      const { cid, sequence } = await allocateClientCid(tx, ctx.organizationId);
      const created = await tx.client.create({
        data: {
          organizationId: ctx.organizationId,
          cid,
          cidSequence: sequence,
          brandName: lead.brandName,
          companyName: lead.name && lead.name !== lead.brandName ? lead.name : null,
          category: lead.category,
          website: lead.website,
          websiteDomain: lead.websiteDomain,
          email: lead.email,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          country: lead.country,
          region: lead.region,
          city: lead.city,
          address: lead.address,
          timezone: lead.timezone ?? (tz.source !== "default" ? tz.timezone : null),
          timezoneSource: lead.timezone ? "lead" : tz.source !== "default" ? tz.source : null,
          followers: lead.followers,
          bio: lead.bio,
          source: lead.source,
          leadScore: lead.leadScore,
          createdByUserId: ctx.userId ?? null,
          lastActivityAt: new Date(),
        },
      });
      await tx.lead.update({ where: { id: lead.id }, data: { clientId: created.id, status: "ADDED", isSaved: true, savedAt: lead.savedAt ?? new Date() } });
      await copyLeadIntoClient(tx, ctx.organizationId, created.id, lead);
      await tx.activity.create({ data: { organizationId: ctx.organizationId, clientId: created.id, type: "client.created", title: "Added to business", description: `From lead ${lead.brandName}`, actorType: "USER", userId: ctx.userId ?? null } });
      return created;
    });
    await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "client.created", entityType: "Client", entityId: client.id, meta: { cid: client.cid, leadId: lead.id } });
    result.created.push({ leadId: lead.id, clientId: client.id, cid: client.cid });
  }
  return result;
}

/** Manual client creation from the Clients page. */
export async function createClientManually(db: DbClient, ctx: CrmContext, input: CreateClientInput): Promise<Client> {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const whatsapp = normalizePhone(input.whatsapp);
  const website = normalizeUrl(input.website);
  const websiteDomain = extractDomain(website);
  const ig = normalizeUsername(input.instagramUsername);
  const fb = input.facebookUrl ? parseSocialUrl(input.facebookUrl) : null;
  const or: Prisma.ClientWhereInput[] = [];
  if (ig) or.push({ socialAccounts: { some: { platform: "INSTAGRAM", username: ig } } });
  if (fb?.username) or.push({ socialAccounts: { some: { platform: "FACEBOOK", username: fb.username } } });
  if (email) or.push({ email });
  if (websiteDomain) or.push({ websiteDomain });
  if (or.length) {
    const dup = await db.client.findFirst({ where: { organizationId: ctx.organizationId, deletedAt: null, OR: or } });
    if (dup) throw new ConflictError(`A client with these details already exists (${dup.cid})`, { cid: dup.cid, clientId: dup.id });
  }
  const tz = resolveTimezone({ country: input.country, region: input.region, city: input.city });
  const client = await db.$transaction(async (tx) => {
    const { cid, sequence } = await allocateClientCid(tx, ctx.organizationId);
    const created = await tx.client.create({
      data: { organizationId: ctx.organizationId, cid, cidSequence: sequence, brandName: input.brandName, companyName: input.companyName, category: input.category, website, websiteDomain, email, phone, whatsapp, country: input.country, region: input.region, city: input.city, address: input.address, timezone: tz.source !== "default" ? tz.timezone : null, timezoneSource: tz.source !== "default" ? tz.source : null, source: "manual", createdByUserId: ctx.userId ?? null, lastActivityAt: new Date() },
    });
    if (ig) await tx.clientSocialAccount.create({ data: { organizationId: ctx.organizationId, clientId: created.id, platform: "INSTAGRAM", username: ig, profileUrl: buildProfileUrl("INSTAGRAM", ig), inboxUrl: buildInboxUrl("INSTAGRAM", { username: ig }), sourceProvider: "manual" } });
    if (fb) await tx.clientSocialAccount.create({ data: { organizationId: ctx.organizationId, clientId: created.id, platform: "FACEBOOK", username: fb.username, profileUrl: fb.profileUrl, externalId: fb.externalId, inboxUrl: buildInboxUrl("FACEBOOK", { username: fb.username, externalId: fb.externalId }), sourceProvider: "manual" } });
    for (const [type, value] of [["EMAIL", email], ["PHONE", phone], ["WHATSAPP", whatsapp], ["WEBSITE", website]] as const) {
      if (value) await tx.clientContact.create({ data: { organizationId: ctx.organizationId, clientId: created.id, type, value, normalizedValue: type === "WEBSITE" ? websiteDomain ?? value : value, source: "MANUAL", confidence: "VERIFIED", isPrimary: true } });
    }
    if (input.notes) await tx.note.create({ data: { organizationId: ctx.organizationId, clientId: created.id, userId: ctx.userId ?? null, body: input.notes } });
    await tx.activity.create({ data: { organizationId: ctx.organizationId, clientId: created.id, type: "client.created", title: "Client created manually", actorType: "USER", userId: ctx.userId ?? null } });
    return created;
  });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "client.created", entityType: "Client", entityId: client.id, meta: { cid: client.cid, manual: true } });
  return client;
}

export type ClientListItem = Prisma.ClientGetPayload<{ include: { socialAccounts: { select: { id: true; platform: true; username: true; profileUrl: true; messagingEligibility: true } }; tags: { include: { tag: true } }; _count: { select: { conversations: true } } } }>;

export async function listClients(db: DbClient, ctx: CrmContext, q: ClientListQuery): Promise<Paginated<ClientListItem>> {
  const page = normalizePage(q);
  const where: Prisma.ClientWhereInput = { organizationId: ctx.organizationId, deletedAt: null };
  if (q.q) where.OR = [{ brandName: { contains: q.q } }, { cid: { contains: q.q } }, { companyName: { contains: q.q } }, { email: { contains: q.q } }, { socialAccounts: { some: { username: { contains: q.q } } } }];
  if (q.status) where.status = q.status;
  if (q.country) where.country = { contains: q.country };
  if (q.tag) where.tags = { some: { tag: { name: q.tag } } };
  if (q.platform) where.socialAccounts = { some: { platform: q.platform } };
  const orderBy: Prisma.ClientOrderByWithRelationInput[] = q.sort === "name" ? [{ brandName: q.order }] : q.sort === "score" ? [{ leadScore: q.order }] : q.sort === "activity" ? [{ lastActivityAt: { sort: q.order, nulls: "last" } }] : q.sort === "cid" ? [{ cidSequence: q.order }] : [{ createdAt: q.order }];
  const [total, items] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({ where, orderBy, skip: (page.page - 1) * page.pageSize, take: page.pageSize, include: { socialAccounts: { select: { id: true, platform: true, username: true, profileUrl: true, messagingEligibility: true } }, tags: { include: { tag: true } }, _count: { select: { conversations: true } } } }),
  ]);
  return paginate(items, total, page);
}

export type ClientDetail = Prisma.ClientGetPayload<{
  include: {
    socialAccounts: true;
    contacts: true;
    tags: { include: { tag: true } };
    notes: { where: { deletedAt: null }; orderBy: { createdAt: "desc" } };
    conversations: { where: { deletedAt: null }; orderBy: { lastMessageAt: "desc" }; select: { id: true; channel: true; status: true; lastMessageAt: true; lastMessagePreview: true; unreadCount: true; messageCount: true; aiStatus: true; needsHumanReview: true; lastIntent: true } };
    scheduledMessages: { where: { status: { in: ["SCHEDULED", "PENDING_APPROVAL", "QUEUED"] } }; orderBy: { scheduledAt: "asc" } };
    documents: { where: { deletedAt: null }; orderBy: { createdAt: "desc" } };
    activities: { orderBy: { createdAt: "desc" }; take: 50 };
    aiActionLogs: { orderBy: { createdAt: "desc" }; take: 20; select: { id: true; action: true; status: true; triggeredBy: true; model: true; confidence: true; createdAt: true; decision: true } };
    lead: { select: { id: true; scoreBreakdown: true; enrichmentStatus: true } };
  };
}>;

export async function getClientByCid(db: DbClient, ctx: CrmContext, cid: string): Promise<ClientDetail> {
  const client = await db.client.findFirst({
    where: { organizationId: ctx.organizationId, cid: cid.toUpperCase() },
    include: {
      socialAccounts: true,
      contacts: true,
      tags: { include: { tag: true } },
      notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      conversations: { where: { deletedAt: null }, orderBy: { lastMessageAt: "desc" }, select: { id: true, channel: true, status: true, lastMessageAt: true, lastMessagePreview: true, unreadCount: true, messageCount: true, aiStatus: true, needsHumanReview: true, lastIntent: true } },
      scheduledMessages: { where: { status: { in: ["SCHEDULED", "PENDING_APPROVAL", "QUEUED"] } }, orderBy: { scheduledAt: "asc" } },
      documents: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
      aiActionLogs: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, status: true, triggeredBy: true, model: true, confidence: true, createdAt: true, decision: true } },
      lead: { select: { id: true, scoreBreakdown: true, enrichmentStatus: true } },
    },
  });
  if (!client) throw new NotFoundError("Client");
  return client;
}

export async function updateClient(db: DbClient, ctx: CrmContext, cid: string, input: UpdateClientInput): Promise<Client> {
  const client = await db.client.findFirst({ where: { organizationId: ctx.organizationId, cid: cid.toUpperCase(), deletedAt: null } });
  if (!client) throw new NotFoundError("Client");
  const data: Prisma.ClientUncheckedUpdateInput = {};
  const set = <K extends keyof UpdateClientInput>(k: K, transform?: (v: NonNullable<UpdateClientInput[K]>) => unknown) => {
    if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k] === null ? null : transform ? transform(input[k] as NonNullable<UpdateClientInput[K]>) : input[k];
  };
  set("brandName");
  set("companyName");
  set("category");
  set("country");
  set("region");
  set("city");
  set("address");
  set("status");
  set("doNotContact");
  set("timezone");
  set("ownerUserId");
  if (input.website !== undefined) {
    data.website = normalizeUrl(input.website);
    data.websiteDomain = extractDomain(input.website);
  }
  if (input.email !== undefined) data.email = normalizeEmail(input.email);
  if (input.phone !== undefined) data.phone = normalizePhone(input.phone);
  if (input.whatsapp !== undefined) data.whatsapp = normalizePhone(input.whatsapp);
  if (input.doNotContact === true) {
    data.status = "DO_NOT_CONTACT";
    data.doNotContactReason = "Marked by user";
  }
  if (input.status && input.status !== "DO_NOT_CONTACT" && input.doNotContact !== true && client.doNotContact && input.doNotContact === false) data.doNotContact = false;
  data.lastActivityAt = new Date();
  const updated = await db.client.update({ where: { id: client.id }, data });
  if (input.instagramUsername !== undefined || input.facebookUrl !== undefined) {
    const ig = normalizeUsername(input.instagramUsername);
    if (ig && !(await db.clientSocialAccount.findFirst({ where: { organizationId: ctx.organizationId, platform: "INSTAGRAM", username: ig } }))) {
      await db.clientSocialAccount.create({ data: { organizationId: ctx.organizationId, clientId: client.id, platform: "INSTAGRAM", username: ig, profileUrl: buildProfileUrl("INSTAGRAM", ig), inboxUrl: buildInboxUrl("INSTAGRAM", { username: ig }), sourceProvider: "manual" } });
    }
    const fb = input.facebookUrl ? parseSocialUrl(input.facebookUrl) : null;
    if (fb && !(await db.clientSocialAccount.findFirst({ where: { organizationId: ctx.organizationId, platform: "FACEBOOK", OR: [{ username: fb.username ?? "-" }, { externalId: fb.externalId ?? "-" }] } }))) {
      await db.clientSocialAccount.create({ data: { organizationId: ctx.organizationId, clientId: client.id, platform: "FACEBOOK", username: fb.username, profileUrl: fb.profileUrl, externalId: fb.externalId, inboxUrl: buildInboxUrl("FACEBOOK", { username: fb.username, externalId: fb.externalId }), sourceProvider: "manual" } });
    }
  }
  if (input.status && input.status !== client.status) {
    await db.activity.create({ data: { organizationId: ctx.organizationId, clientId: client.id, type: "client.status", title: `Status changed to ${input.status.replace(/_/g, " ").toLowerCase()}`, actorType: "USER", userId: ctx.userId ?? null } });
  }
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "client.updated", entityType: "Client", entityId: client.id, meta: { fields: Object.keys(input) } });
  return updated;
}

export async function addClientNote(db: DbClient, ctx: CrmContext, cid: string, body: string) {
  const client = await db.client.findFirst({ where: { organizationId: ctx.organizationId, cid: cid.toUpperCase(), deletedAt: null }, select: { id: true } });
  if (!client) throw new NotFoundError("Client");
  const note = await db.note.create({ data: { organizationId: ctx.organizationId, clientId: client.id, userId: ctx.userId ?? null, body } });
  await db.client.update({ where: { id: client.id }, data: { lastActivityAt: new Date() } });
  return note;
}

export async function setClientTags(db: DbClient, ctx: CrmContext, cid: string, tags: string[]): Promise<void> {
  const client = await db.client.findFirst({ where: { organizationId: ctx.organizationId, cid: cid.toUpperCase(), deletedAt: null }, select: { id: true } });
  if (!client) throw new NotFoundError("Client");
  await db.clientTag.deleteMany({ where: { clientId: client.id } });
  for (const name of [...new Set(tags.map((t) => t.trim()).filter(Boolean))]) {
    const tag = await db.tag.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name } }, create: { organizationId: ctx.organizationId, name }, update: {} });
    await db.clientTag.create({ data: { clientId: client.id, tagId: tag.id } });
  }
}

export async function listTags(db: DbClient, organizationId: string) {
  return db.tag.findMany({ where: { organizationId }, orderBy: { name: "asc" }, include: { _count: { select: { clients: true, leads: true } } } });
}

export function platformAccount<T extends { platform: Platform }>(accounts: T[], platform: Platform): T | undefined {
  return accounts.find((a) => a.platform === platform);
}

export type { Lead };
