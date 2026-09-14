import { ingestKnowledgeText } from "@oses/ai";
import { writeAudit } from "@oses/database";
import { knowledgeTextSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({
  items: await ctx.db.knowledgeDocument.findMany({ where: { organizationId: ctx.organizationId, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, sourceType: true, status: true, charCount: true, chunkCount: true, error: true, documentId: true, createdAt: true, updatedAt: true } }),
}));

/** Add knowledge from pasted text (TXT uploads go through /api/documents with addToKnowledge=true). */
export const POST = withApi(
  async (ctx) => {
    const result = await ingestKnowledgeText(ctx.db, ctx.organizationId, { title: ctx.body.title, content: ctx.body.content, sourceType: "TEXT" });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "ai.knowledge_added", entityType: "KnowledgeDocument", entityId: result.knowledgeDocumentId, meta: { chunks: result.chunkCount, title: ctx.body.title } });
    return result;
  },
  { body: knowledgeTextSchema },
);
