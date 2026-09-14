import { writeAudit } from "@oses/database";
import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const doc = await ctx.db.knowledgeDocument.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId }, include: { chunks: { orderBy: { chunkIndex: "asc" }, select: { id: true, chunkIndex: true, content: true, tokenEstimate: true, embeddingModel: true } } } });
  if (!doc) throw new NotFoundError("Knowledge document");
  return { item: doc };
});

export const DELETE = withApi(async (ctx) => {
  const doc = await ctx.db.knowledgeDocument.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
  if (!doc) throw new NotFoundError("Knowledge document");
  await ctx.db.knowledgeDocument.delete({ where: { id: doc.id } });
  await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "ai.knowledge_deleted", entityType: "KnowledgeDocument", entityId: doc.id, meta: { title: doc.title } });
  return { ok: true };
});
