import type { DbClient, Lead, Prisma } from "@oses/database";
import { addToTrash, markRestored, writeAudit } from "@oses/database";
import { getEnv, NotFoundError, normalizePage, paginate, type Paginated } from "@oses/shared";
import type { LeadListQuery } from "@oses/validation";
import type { RequestContext } from "./search-service";

export type LeadListItem = Lead & {
  tags: Array<{ tag: { id: string; name: string; color: string | null } }>;
  _count: { socialAccounts: number; contacts: number };
};

export type LeadDetail = Prisma.LeadGetPayload<{
  include: {
    socialAccounts: true;
    contacts: true;
    tags: { include: { tag: true } };
    notesList: { where: { deletedAt: null }; orderBy: { createdAt: "desc" } };
    searchRuns: { include: { searchRun: { select: { id: true; query: true; createdAt: true; criteria: true } } } };
    client: { select: { id: true; cid: true; status: true } };
  };
}>;

export function buildLeadWhere(organizationId: string, q: LeadListQuery): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = { organizationId, deletedAt: null };
  if (q.q) {
    where.OR = [{ brandName: { contains: q.q } }, { username: { contains: q.q } }, { bio: { contains: q.q } }, { email: { contains: q.q } }, { websiteDomain: { contains: q.q } }];
  }
  if (q.platform) where.primaryPlatform = q.platform;
  if (q.country) where.country = { contains: q.country };
  if (q.region) where.region = { contains: q.region };
  if (q.city) where.city = { contains: q.city };
  if (q.minFollowers != null) where.followers = { ...(where.followers as object), gte: q.minFollowers };
  if (q.maxFollowers != null) where.followers = { ...(where.followers as object), lte: q.maxFollowers };
  if (q.hasEmail) where.email = { not: null };
  if (q.hasPhone) where.phone = { not: null };
  if (q.hasWhatsApp) where.whatsapp = { not: null };
  if (q.hasWebsite) where.website = { not: null };
  if (q.minScore != null) where.leadScore = { gte: q.minScore };
  if (q.saved != null) where.isSaved = q.saved;
  if (q.added != null) where.clientId = q.added ? { not: null } : null;
  if (q.searchRunId) where.searchRuns = { some: { searchRunId: q.searchRunId } };
  if (q.tag) where.tags = { some: { tag: { name: q.tag } } };
  if (q.contacted != null) where.client = q.contacted ? { lastContactedAt: { not: null } } : undefined;
  return where;
}

function orderBy(q: LeadListQuery): Prisma.LeadOrderByWithRelationInput[] {
  const dir = q.order;
  switch (q.sort) {
    case "followers":
      return [{ followers: { sort: dir, nulls: "last" } }, { leadScore: "desc" }];
    case "newest":
      return [{ createdAt: dir }];
    case "name":
      return [{ brandName: dir }];
    default:
      return [{ leadScore: dir }, { followers: { sort: "desc", nulls: "last" } }];
  }
}

export async function listLeads(db: DbClient, ctx: RequestContext, q: LeadListQuery): Promise<Paginated<LeadListItem>> {
  const page = normalizePage(q);
  const where = buildLeadWhere(ctx.organizationId, q);
  const [total, items] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      orderBy: orderBy(q),
      skip: (page.page - 1) * page.pageSize,
      take: page.pageSize,
      include: { tags: { include: { tag: { select: { id: true, name: true, color: true } } } }, _count: { select: { socialAccounts: true, contacts: true } } },
    }),
  ]);
  return paginate(items as LeadListItem[], total, page);
}

export async function getLeadDetail(db: DbClient, ctx: RequestContext, id: string): Promise<LeadDetail> {
  const lead = await db.lead.findFirst({
    where: { id, organizationId: ctx.organizationId },
    include: {
      socialAccounts: true,
      contacts: true,
      tags: { include: { tag: true } },
      notesList: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
      searchRuns: { include: { searchRun: { select: { id: true, query: true, createdAt: true, criteria: true } } } },
      client: { select: { id: true, cid: true, status: true } },
    },
  });
  if (!lead) throw new NotFoundError("Lead");
  return lead;
}

export async function setLeadsSaved(db: DbClient, ctx: RequestContext, leadIds: string[], saved: boolean): Promise<number> {
  const res = await db.lead.updateMany({
    where: { id: { in: leadIds }, organizationId: ctx.organizationId, deletedAt: null },
    data: saved ? { isSaved: true, savedAt: new Date(), savedByUserId: ctx.userId ?? null, status: "SAVED" } : { isSaved: false, savedAt: null, savedByUserId: null },
  });
  if (!saved) await db.lead.updateMany({ where: { id: { in: leadIds }, organizationId: ctx.organizationId, clientId: null, status: "SAVED" }, data: { status: "DISCOVERED" } });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: saved ? "lead.saved" : "lead.unsaved", entityType: "Lead", meta: { count: res.count, leadIds: leadIds.slice(0, 50) } });
  return res.count;
}

export async function trashLeads(db: DbClient, ctx: RequestContext, leadIds: string[]): Promise<number> {
  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, organizationId: ctx.organizationId, deletedAt: null }, select: { id: true, brandName: true } });
  const now = new Date();
  const retention = getEnv().TRASH_RETENTION_DAYS;
  for (const l of leads) {
    await db.lead.update({ where: { id: l.id }, data: { deletedAt: now } });
    await addToTrash(db, { organizationId: ctx.organizationId, entityType: "LEAD", entityId: l.id, label: l.brandName, deletedByUserId: ctx.userId ?? null, retentionDays: retention });
  }
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "lead.deleted", entityType: "Lead", meta: { count: leads.length } });
  return leads.length;
}

export async function restoreLead(db: DbClient, ctx: RequestContext, leadId: string): Promise<void> {
  const res = await db.lead.updateMany({ where: { id: leadId, organizationId: ctx.organizationId, deletedAt: { not: null } }, data: { deletedAt: null } });
  if (!res.count) throw new NotFoundError("Lead");
  await markRestored(db, "LEAD", leadId);
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: "lead.restored", entityType: "Lead", entityId: leadId });
}

export async function purgeLead(db: DbClient, organizationId: string, leadId: string): Promise<void> {
  await db.lead.deleteMany({ where: { id: leadId, organizationId } });
  await db.trashItem.updateMany({ where: { entityType: "LEAD", entityId: leadId }, data: { purgedAt: new Date() } });
}

export async function updateLeadNotesAndTags(db: DbClient, ctx: RequestContext, leadId: string, input: { notes?: string | null; tags?: string[] }): Promise<void> {
  const lead = await db.lead.findFirst({ where: { id: leadId, organizationId: ctx.organizationId, deletedAt: null }, select: { id: true } });
  if (!lead) throw new NotFoundError("Lead");
  if (input.notes !== undefined) await db.lead.update({ where: { id: leadId }, data: { notes: input.notes } });
  if (input.tags) {
    await db.leadTag.deleteMany({ where: { leadId } });
    for (const name of input.tags) {
      const tag = await db.tag.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name } }, create: { organizationId: ctx.organizationId, name }, update: {} });
      await db.leadTag.create({ data: { leadId, tagId: tag.id } });
    }
  }
}

export async function addTagToLeads(db: DbClient, ctx: RequestContext, leadIds: string[], tagName: string): Promise<void> {
  const tag = await db.tag.upsert({ where: { organizationId_name: { organizationId: ctx.organizationId, name: tagName } }, create: { organizationId: ctx.organizationId, name: tagName }, update: {} });
  const leads = await db.lead.findMany({ where: { id: { in: leadIds }, organizationId: ctx.organizationId }, select: { id: true } });
  for (const l of leads) {
    await db.leadTag.upsert({ where: { leadId_tagId: { leadId: l.id, tagId: tag.id } }, create: { leadId: l.id, tagId: tag.id }, update: {} });
  }
}

/** Saved search CRUD */
export async function listSavedSearches(db: DbClient, ctx: RequestContext) {
  return db.savedSearch.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null }, orderBy: { updatedAt: "desc" } });
}

export async function createSavedSearch(db: DbClient, ctx: RequestContext, input: { name: string; criteria: unknown }) {
  return db.savedSearch.create({ data: { organizationId: ctx.organizationId, userId: ctx.userId ?? null, name: input.name, criteria: input.criteria as object } });
}

export async function deleteSavedSearch(db: DbClient, ctx: RequestContext, id: string): Promise<void> {
  const row = await db.savedSearch.findFirst({ where: { id, organizationId: ctx.organizationId, deletedAt: null } });
  if (!row) throw new NotFoundError("Saved search");
  await db.savedSearch.update({ where: { id }, data: { deletedAt: new Date() } });
  await addToTrash(db, { organizationId: ctx.organizationId, entityType: "SAVED_SEARCH", entityId: id, label: row.name, deletedByUserId: ctx.userId ?? null, retentionDays: getEnv().TRASH_RETENTION_DAYS });
}
