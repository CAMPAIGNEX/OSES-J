import { addDays } from "@oses/shared";
import type { TrashEntityType } from "../generated/prisma/enums";
import type { DbClient } from "./client";

/** Register a soft-deleted entity in the Trash so it can be restored or purged later. */
export async function addToTrash(
  tx: DbClient,
  input: {
    organizationId: string;
    entityType: TrashEntityType;
    entityId: string;
    label: string;
    deletedByUserId?: string | null;
    retentionDays?: number;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date();
  await tx.trashItem.upsert({
    where: { entityType_entityId: { entityType: input.entityType, entityId: input.entityId } },
    create: {
      organizationId: input.organizationId,
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label.slice(0, 255),
      deletedByUserId: input.deletedByUserId ?? null,
      deletedAt: now,
      purgeAt: addDays(now, input.retentionDays ?? 7),
      meta: input.meta ? (input.meta as object) : undefined,
    },
    update: {
      label: input.label.slice(0, 255),
      deletedByUserId: input.deletedByUserId ?? null,
      deletedAt: now,
      purgeAt: addDays(now, input.retentionDays ?? 7),
      restoredAt: null,
      purgedAt: null,
    },
  });
}

export async function markRestored(tx: DbClient, entityType: TrashEntityType, entityId: string): Promise<void> {
  await tx.trashItem.updateMany({ where: { entityType, entityId }, data: { restoredAt: new Date() } });
}
