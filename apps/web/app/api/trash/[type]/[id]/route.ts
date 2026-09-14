import { purgeTrashItem } from "@oses/automation";
import { writeAudit } from "@oses/database";
import { NotFoundError } from "@oses/shared";
import type { TrashEntityType } from "@oses/database";
import { withApi } from "@/lib/server/api";

/** Permanently delete a trashed item. */
export const DELETE = withApi(async (ctx) => {
  const entityType = (ctx.params.type ?? "").toUpperCase() as TrashEntityType;
  const item = await ctx.db.trashItem.findFirst({ where: { organizationId: ctx.organizationId, entityType, entityId: ctx.params.id ?? "", purgedAt: null } });
  if (!item) throw new NotFoundError("Trash item");
  await purgeTrashItem(ctx.db, ctx.organizationId, entityType, item.entityId);
  await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: `${entityType.toLowerCase()}.purged`, entityType, entityId: item.entityId, meta: { label: item.label } });
  return { ok: true };
});
