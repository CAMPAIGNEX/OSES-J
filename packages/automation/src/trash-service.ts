import type { DbClient, TrashEntityType } from "@oses/database";
import { addToTrash, markRestored, writeAudit } from "@oses/database";
import { createLogger, errorMessage, getEnv, getStorage, NotFoundError, normalizePage, paginate, type Paginated } from "@oses/shared";

const log = createLogger("automation.trash");

export interface TrashContext {
  organizationId: string;
  userId?: string | null;
}

/** Soft-delete an entity and register it in the Trash (7-day retention by default). */
export async function moveToTrash(db: DbClient, ctx: TrashContext, entityType: TrashEntityType, entityId: string): Promise<void> {
  const now = new Date();
  const retention = getEnv().TRASH_RETENTION_DAYS;
  let label = entityId;
  switch (entityType) {
    case "CLIENT": {
      const row = await db.client.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Client");
      await db.client.update({ where: { id: entityId }, data: { deletedAt: now } });
      await db.scheduledMessage.updateMany({ where: { clientId: entityId, status: { in: ["SCHEDULED", "PENDING_APPROVAL"] } }, data: { status: "CANCELLED", cancelledAt: now } });
      await db.campaignLead.updateMany({ where: { clientId: entityId, status: { in: ["PENDING", "SCHEDULED", "CONTACTED"] } }, data: { status: "STOPPED", stopReason: "client deleted" } });
      label = `${row.cid} ${row.brandName}`;
      break;
    }
    case "DOCUMENT": {
      const row = await db.document.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Document");
      await db.document.update({ where: { id: entityId }, data: { deletedAt: now } });
      await db.knowledgeDocument.updateMany({ where: { documentId: entityId }, data: { deletedAt: now } });
      label = row.name;
      break;
    }
    case "LEAD": {
      const row = await db.lead.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Lead");
      await db.lead.update({ where: { id: entityId }, data: { deletedAt: now } });
      label = row.brandName;
      break;
    }
    case "CAMPAIGN": {
      const row = await db.campaign.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Campaign");
      await db.campaign.update({ where: { id: entityId }, data: { deletedAt: now, status: row.status === "RUNNING" ? "CANCELLED" : row.status } });
      label = row.name;
      break;
    }
    case "NOTE": {
      const row = await db.note.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Note");
      await db.note.update({ where: { id: entityId }, data: { deletedAt: now } });
      label = row.body.slice(0, 80);
      break;
    }
    case "CONVERSATION": {
      const row = await db.conversation.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null }, include: { client: { select: { brandName: true } } } });
      if (!row) throw new NotFoundError("Conversation");
      await db.conversation.update({ where: { id: entityId }, data: { deletedAt: now } });
      label = `Conversation with ${row.client.brandName}`;
      break;
    }
    case "SAVED_SEARCH": {
      const row = await db.savedSearch.findFirst({ where: { id: entityId, organizationId: ctx.organizationId, deletedAt: null } });
      if (!row) throw new NotFoundError("Saved search");
      await db.savedSearch.update({ where: { id: entityId }, data: { deletedAt: now } });
      label = row.name;
      break;
    }
  }
  await addToTrash(db, { organizationId: ctx.organizationId, entityType, entityId, label, deletedByUserId: ctx.userId ?? null, retentionDays: retention });
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: `${entityType.toLowerCase()}.deleted`, entityType, entityId, meta: { label } });
}

export async function restoreFromTrash(db: DbClient, ctx: TrashContext, entityType: TrashEntityType, entityId: string): Promise<void> {
  const item = await db.trashItem.findFirst({ where: { entityType, entityId, organizationId: ctx.organizationId, purgedAt: null } });
  if (!item) throw new NotFoundError("Trash item");
  const data = { deletedAt: null };
  switch (entityType) {
    case "CLIENT":
      await db.client.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
    case "DOCUMENT":
      await db.document.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      await db.knowledgeDocument.updateMany({ where: { documentId: entityId }, data });
      break;
    case "LEAD":
      await db.lead.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
    case "CAMPAIGN":
      await db.campaign.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
    case "NOTE":
      await db.note.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
    case "CONVERSATION":
      await db.conversation.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
    case "SAVED_SEARCH":
      await db.savedSearch.updateMany({ where: { id: entityId, organizationId: ctx.organizationId }, data });
      break;
  }
  await markRestored(db, entityType, entityId);
  await writeAudit(db, { organizationId: ctx.organizationId, userId: ctx.userId ?? null, action: `${entityType.toLowerCase()}.restored`, entityType, entityId });
}

/** Permanently delete one trashed entity (and its stored file, when applicable). */
export async function purgeTrashItem(db: DbClient, organizationId: string, entityType: TrashEntityType, entityId: string): Promise<void> {
  switch (entityType) {
    case "CLIENT":
      await db.client.deleteMany({ where: { id: entityId, organizationId } });
      break;
    case "DOCUMENT": {
      const doc = await db.document.findFirst({ where: { id: entityId, organizationId } });
      if (doc) {
        await getStorage().delete(doc.storageKey).catch((err) => log.warn("file delete failed", { key: doc.storageKey, error: errorMessage(err) }));
        await db.document.delete({ where: { id: doc.id } });
      }
      break;
    }
    case "LEAD":
      await db.lead.deleteMany({ where: { id: entityId, organizationId } });
      break;
    case "CAMPAIGN":
      await db.campaign.deleteMany({ where: { id: entityId, organizationId } });
      break;
    case "NOTE":
      await db.note.deleteMany({ where: { id: entityId, organizationId } });
      break;
    case "CONVERSATION":
      await db.conversation.deleteMany({ where: { id: entityId, organizationId } });
      break;
    case "SAVED_SEARCH":
      await db.savedSearch.deleteMany({ where: { id: entityId, organizationId } });
      break;
  }
  await db.trashItem.updateMany({ where: { entityType, entityId }, data: { purgedAt: new Date() } });
}

export async function purgeExpiredTrash(db: DbClient): Promise<number> {
  const due = await db.trashItem.findMany({ where: { purgedAt: null, restoredAt: null, purgeAt: { lte: new Date() } }, take: 500 });
  let purged = 0;
  for (const item of due) {
    try {
      await purgeTrashItem(db, item.organizationId, item.entityType, item.entityId);
      purged++;
    } catch (err) {
      log.error("purge failed", { entityType: item.entityType, entityId: item.entityId, error: errorMessage(err) });
    }
  }
  return purged;
}

export async function listTrash(db: DbClient, ctx: TrashContext, query: { page?: number; pageSize?: number; entityType?: TrashEntityType }): Promise<Paginated<{ id: string; entityType: TrashEntityType; entityId: string; label: string; deletedAt: Date; purgeAt: Date; deletedByUserId: string | null }>> {
  const page = normalizePage(query);
  const where = { organizationId: ctx.organizationId, purgedAt: null, restoredAt: null, ...(query.entityType ? { entityType: query.entityType } : {}) };
  const [total, items] = await Promise.all([db.trashItem.count({ where }), db.trashItem.findMany({ where, orderBy: { deletedAt: "desc" }, skip: (page.page - 1) * page.pageSize, take: page.pageSize })]);
  return paginate(items.map((i) => ({ id: i.id, entityType: i.entityType, entityId: i.entityId, label: i.label, deletedAt: i.deletedAt, purgeAt: i.purgeAt, deletedByUserId: i.deletedByUserId })), total, page);
}
