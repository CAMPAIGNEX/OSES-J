import { recordJobResult } from "@oses/messaging";
import { NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

/** Cancel a queued delivery job (the message is marked cancelled and never sent). */
export const DELETE = withApi(async (ctx) => {
  const job = await ctx.db.messageJob.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
  if (!job) throw new NotFoundError("Job");
  if (!["QUEUED", "RETRYING", "CLAIMED"].includes(job.status)) return { ok: false, reason: `job is ${job.status}` };
  await recordJobResult(ctx.db, job.id, { status: "CANCELLED", errorMessage: "Cancelled by user" });
  return { ok: true };
});
