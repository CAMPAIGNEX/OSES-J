import { buildXlsx, leadRowsForExport, storeExportDocument } from "@oses/automation";
import { recordUsage, writeAudit } from "@oses/database";
import { exportLeadsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { enqueueJob } from "@/lib/server/jobs";

const SYNC_LIMIT = 2000;

/** Small exports stream back immediately; large ones become an EXPORT_JOB and land in Documents. */
export const POST = withApi(
  async (ctx) => {
    const input = ctx.body;
    const rows = await leadRowsForExport(ctx.db, ctx.organizationId, { leadIds: input.scope === "selected" ? input.leadIds : undefined, filters: input.scope === "filtered" ? input.filters : undefined });
    if (rows.length > SYNC_LIMIT) {
      const job = await enqueueJob({ type: "EXPORT_JOB", organizationId: ctx.organizationId, payload: { kind: "leads", leadIds: input.leadIds, filters: input.filters, userId: ctx.userId } });
      return { queued: true, jobId: job.id, rows: rows.length };
    }
    const buffer = await buildXlsx(rows, "Leads");
    const name = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
    if (ctx.query.get("store") === "1") {
      const { documentId } = await storeExportDocument(ctx.db, ctx.organizationId, ctx.userId, name, buffer);
      return { documentId, rows: rows.length };
    }
    await recordUsage(ctx.db, ctx.organizationId, "EXPORTS", 1);
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "export.downloaded", meta: { rows: rows.length, kind: "leads" } });
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${name}"` } });
  },
  { body: exportLeadsSchema },
);
