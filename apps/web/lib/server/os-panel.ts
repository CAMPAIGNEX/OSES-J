import "server-only";
import { writeAudit } from "@oses/database";
import type { ApiContext } from "@/lib/server/api";

/** Audit helper for OS-Panel mutations: records the operator on the target organization. */
export async function osAudit(ctx: Pick<ApiContext, "db" | "session" | "ip">, input: { action: string; organizationId?: string | null; entityType?: string; entityId?: string; meta?: Record<string, unknown> }): Promise<void> {
  await writeAudit(ctx.db, {
    organizationId: input.organizationId ?? null,
    userId: ctx.session.user.id,
    actorType: "USER",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    ip: ctx.ip,
    meta: { ...input.meta, operator: ctx.session.user.email, via: "os-panel" },
  });
}

export function paging(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
