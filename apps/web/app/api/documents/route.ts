import { moveToTrash } from "@oses/automation";
import { recordUsage, writeAudit } from "@oses/database";
import { buildStorageKey, getStorage, ValidationError } from "@oses/shared";
import { documentListQuerySchema, documentMetaSchema } from "@oses/validation";
import { parseQuery, withApi } from "@/lib/server/api";
import { enqueueJob } from "@/lib/server/jobs";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["txt", "text/plain"],
  ["md", "text/markdown"],
  ["csv", "text/csv"],
  ["json", "application/json"],
  ["pdf", "application/pdf"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
]);

export const GET = withApi(async (ctx) => {
  const q = parseQuery(ctx.query, documentListQuerySchema);
  const where = { organizationId: ctx.organizationId, deletedAt: null, ...(q.kind ? { kind: q.kind } : {}), ...(q.clientId ? { clientId: q.clientId } : {}), ...(q.q ? { name: { contains: q.q } } : {}) };
  const [total, items] = await Promise.all([
    ctx.db.document.count({ where }),
    ctx.db.document.findMany({ where, orderBy: { createdAt: "desc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: { client: { select: { cid: true, brandName: true } }, knowledgeDocument: { select: { id: true, status: true, chunkCount: true, error: true } } } }),
  ]);
  return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
});

/** Multipart upload: file + optional metadata. TXT/MD/CSV can be added to the AI knowledge base. */
export const POST = withApi(async (ctx) => {
  const form = await ctx.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ValidationError("Choose a file to upload", [{ path: "file", message: "Required" }]);
  if (file.size > MAX_BYTES) throw new ValidationError("File is larger than 25 MB", [{ path: "file", message: "Too large" }]);
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const mime = ALLOWED.get(ext);
  if (!mime) throw new ValidationError(`Unsupported file type .${ext}. Allowed: ${[...ALLOWED.keys()].join(", ")}`, [{ path: "file", message: "Unsupported type" }]);
  const metaRaw = { kind: form.get("kind") ?? undefined, clientId: form.get("clientId") || undefined, conversationId: form.get("conversationId") || undefined, campaignId: form.get("campaignId") || undefined, addToKnowledge: form.get("addToKnowledge") === "true", title: form.get("title") || undefined };
  const meta = documentMetaSchema.parse(metaRaw);
  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await getStorage().put(buildStorageKey(ctx.organizationId, "documents", file.name), buffer);
  const doc = await ctx.db.document.create({
    data: { organizationId: ctx.organizationId, name: meta.title?.trim() || file.name, originalName: file.name, mimeType: mime, sizeBytes: stored.sizeBytes, storageKey: stored.key, storageDriver: getStorage().driver, kind: meta.addToKnowledge && meta.kind === "OTHER" ? "KNOWLEDGE" : meta.kind, clientId: meta.clientId ?? null, conversationId: meta.conversationId ?? null, campaignId: meta.campaignId ?? null, uploadedByUserId: ctx.userId, checksum: stored.checksum },
  });
  await recordUsage(ctx.db, ctx.organizationId, "STORAGE_BYTES", stored.sizeBytes);
  await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "document.uploaded", entityType: "Document", entityId: doc.id, meta: { name: doc.name, sizeBytes: doc.sizeBytes, kind: doc.kind } });
  if (meta.addToKnowledge) {
    await ctx.db.knowledgeDocument.create({ data: { organizationId: ctx.organizationId, documentId: doc.id, title: doc.name, sourceType: "FILE", status: "PENDING" } });
    await enqueueJob({ type: "DOCUMENT_PROCESSING_JOB", organizationId: ctx.organizationId, payload: { documentId: doc.id }, entityType: "Document", entityId: doc.id });
  }
  return { document: doc };
});

export const DELETE = withApi(async (ctx) => {
  const id = ctx.query.get("id") ?? "";
  await moveToTrash(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId }, "DOCUMENT", id);
  return { ok: true };
});
