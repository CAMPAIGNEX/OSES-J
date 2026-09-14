import { ingestKnowledgeText } from "@oses/ai";
import { errorMessage, getStorage } from "@oses/shared";
import { runCompetitorAnalysis, runTrendAnalysis } from "../analysis-service";
import { processCampaignStep } from "../campaign-service";
import { buildXlsx, clientRowsForExport, leadRowsForExport, storeExportDocument } from "../export-service";
import type { JobContext } from "../runner";
import { purgeExpiredTrash } from "../trash-service";

/** TRASH_CLEANUP_JOB: permanently delete trash items past their retention date. */
export async function handleTrashCleanupJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const purged = await purgeExpiredTrash(ctx.db);
  return { purged };
}

/** EXPORT_JOB: build an XLSX file for large exports and store it as a Document. */
export async function handleExportJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const organizationId = ctx.organizationId;
  if (!organizationId) return { skipped: "no organization" };
  const kind = String(ctx.payload.kind ?? "leads");
  const userId = (ctx.payload.userId as string | null) ?? null;
  const rows = kind === "clients" ? await clientRowsForExport(ctx.db, organizationId, ctx.payload.clientIds as string[] | undefined) : await leadRowsForExport(ctx.db, organizationId, { leadIds: ctx.payload.leadIds as string[] | undefined, filters: ctx.payload.filters as Record<string, unknown> | undefined });
  const buffer = await buildXlsx(rows, kind === "clients" ? "Clients" : "Leads");
  const name = `${kind}-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  const { documentId } = await storeExportDocument(ctx.db, organizationId, userId, name, buffer);
  return { documentId, rows: rows.length };
}

const TEXT_MIME = /^(text\/plain|text\/markdown|text\/csv|application\/json)$/i;

/** DOCUMENT_PROCESSING_JOB: extract text from an uploaded document and add it to the knowledge base. */
export async function handleDocumentProcessingJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const documentId = String(ctx.payload.documentId ?? "");
  const doc = await ctx.db.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return { skipped: "document not found" };
  const knowledge = await ctx.db.knowledgeDocument.findFirst({ where: { documentId: doc.id } });
  if (!TEXT_MIME.test(doc.mimeType) && !/\.(txt|md|csv|json)$/i.test(doc.originalName)) {
    await ctx.db.knowledgeDocument.updateMany({ where: { documentId: doc.id }, data: { status: "FAILED", error: `Text extraction for ${doc.mimeType} is not available in this build; upload TXT/Markdown/CSV for the knowledge base.` } });
    return { skipped: "unsupported mime type", mimeType: doc.mimeType };
  }
  try {
    const buffer = await getStorage().get(doc.storageKey);
    const raw = buffer.toString("utf8");
    const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw; // strip UTF-8 BOM
    const result = await ingestKnowledgeText(ctx.db, doc.organizationId, { title: doc.name, content: text, documentId: doc.id, sourceType: "FILE", knowledgeDocumentId: knowledge?.id });
    return { knowledgeDocumentId: result.knowledgeDocumentId, chunks: result.chunkCount };
  } catch (err) {
    await ctx.db.knowledgeDocument.updateMany({ where: { documentId: doc.id }, data: { status: "FAILED", error: errorMessage(err).slice(0, 2000) } });
    throw err;
  }
}

/** CAMPAIGN_STEP_JOB: process pending campaign leads within the daily budget. */
export async function handleCampaignStepJob(ctx: JobContext): Promise<Record<string, unknown>> {
  const campaignId = String(ctx.payload.campaignId ?? "");
  return processCampaignStep(ctx.db, ctx.queue, campaignId);
}

export async function handleCompetitorAnalysisJob(ctx: JobContext): Promise<Record<string, unknown>> {
  return runCompetitorAnalysis(ctx.db, String(ctx.payload.competitorSearchId ?? ""));
}

export async function handleTrendAnalysisJob(ctx: JobContext): Promise<Record<string, unknown>> {
  return runTrendAnalysis(ctx.db, String(ctx.payload.trendSearchId ?? ""));
}
