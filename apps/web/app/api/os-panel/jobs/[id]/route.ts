import { ConflictError, NotFoundError } from "@oses/shared";
import { z } from "zod";
import { withApi } from "@/lib/server/api";
import { osAudit } from "@/lib/server/os-panel";
import { kickInlineRunner } from "@/lib/server/jobs";

const actionSchema = z.object({ action: z.enum(["retry", "cancel"]) });

export const GET = withApi(
  async ({ db, params }) => {
    const job = await db.automationJob.findUnique({ where: { id: params.id ?? "" }, include: { organization: { select: { name: true } } } });
    if (!job) throw new NotFoundError("Job");
    return { job };
  },
  { superAdminOnly: true },
);

/** Retry a failed/cancelled job or cancel a queued one. */
export const POST = withApi(
  async (ctx) => {
    const id = ctx.params.id ?? "";
    const job = await ctx.db.automationJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundError("Job");
    if (ctx.body.action === "retry") {
      if (job.status === "RUNNING") throw new ConflictError("The job is running");
      await ctx.db.automationJob.update({ where: { id }, data: { status: "QUEUED", scheduledAt: new Date(), error: null, errorClass: null, lockedBy: null, lockedAt: null, startedAt: null, completedAt: null, maxAttempts: Math.max(job.maxAttempts, job.attempts + 1) } });
      kickInlineRunner();
    } else {
      if (job.status !== "QUEUED" && job.status !== "RUNNING") throw new ConflictError("Only queued or running jobs can be cancelled");
      await ctx.db.automationJob.update({ where: { id }, data: { status: "CANCELLED", completedAt: new Date(), lockedBy: null, lockedAt: null } });
    }
    await osAudit(ctx, { action: ctx.body.action === "retry" ? "os.job_retried" : "os.job_cancelled", organizationId: job.organizationId, entityType: "AutomationJob", entityId: id, meta: { type: job.type } });
    return { ok: true };
  },
  { superAdminOnly: true, body: actionSchema },
);
