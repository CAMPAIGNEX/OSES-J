import { writeAudit } from "@oses/database";
import { instructionSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ items: await ctx.db.aIInstruction.findMany({ where: { organizationId: ctx.organizationId }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }) }));

export const POST = withApi(
  async (ctx) => {
    const count = await ctx.db.aIInstruction.count({ where: { organizationId: ctx.organizationId } });
    const item = await ctx.db.aIInstruction.create({ data: { organizationId: ctx.organizationId, kind: ctx.body.kind, title: ctx.body.title, content: ctx.body.content, enabled: ctx.body.enabled, sortOrder: ctx.body.sortOrder ?? count } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "ai.instruction_created", entityType: "AIInstruction", entityId: item.id, meta: { kind: item.kind, title: item.title } });
    return { item };
  },
  { body: instructionSchema },
);
