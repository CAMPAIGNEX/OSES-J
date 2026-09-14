import { moveToTrash } from "@oses/automation";
import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const doc = await ctx.db.document.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId }, include: { knowledgeDocument: true, client: { select: { cid: true, brandName: true } } } });
  if (!doc) throw new NotFoundError("Document");
  return { document: doc };
});

export const DELETE = withApi(async (ctx) => {
  await moveToTrash(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId }, "DOCUMENT", ctx.params.id ?? "");
  return { ok: true };
});
