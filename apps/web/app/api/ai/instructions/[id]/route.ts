import { writeAudit } from "@oses/database";
import { NotFoundError } from "@oses/shared";
import { updateInstructionSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const PATCH = withApi(
  async (ctx) => {
    const existing = await ctx.db.aIInstruction.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
    if (!existing) throw new NotFoundError("Instruction");
    const item = await ctx.db.aIInstruction.update({ where: { id: existing.id }, data: ctx.body });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "ai.instruction_updated", entityType: "AIInstruction", entityId: item.id });
    return { item };
  },
  { body: updateInstructionSchema },
);

export const DELETE = withApi(async (ctx) => {
  const res = await ctx.db.aIInstruction.deleteMany({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
  if (!res.count) throw new NotFoundError("Instruction");
  await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "ai.instruction_deleted", entityType: "AIInstruction", entityId: ctx.params.id });
  return { ok: true };
});
