import type { ActorType } from "../generated/prisma/enums";
import type { DbClient } from "./client";

export interface AuditEntry {
  organizationId?: string | null;
  userId?: string | null;
  actorType?: ActorType;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Write an audit log row. Never throws: auditing must not break the main operation. */
export async function writeAudit(tx: DbClient, entry: AuditEntry): Promise<void> {
  try {
    await tx.auditLog.create({
      data: {
        organizationId: entry.organizationId ?? null,
        userId: entry.userId ?? null,
        actorType: entry.actorType ?? "USER",
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        meta: entry.meta === undefined ? undefined : (entry.meta as object | null) ?? undefined,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent?.slice(0, 255) ?? null,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("audit log write failed", err);
  }
}
