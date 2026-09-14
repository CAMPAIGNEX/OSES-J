import { formatCid } from "@oses/shared";
import type { DbClient } from "./client";

export const CLIENT_COUNTER_KEY = "client_cid";

/**
 * Atomically allocate the next client sequence number for an organization.
 *
 * Uses a single UPDATE on the counter row (InnoDB row lock) inside the caller's transaction,
 * then reads the value back on the same connection. Numbers are never reused, even after
 * permanent deletion, so a CID is unique for the lifetime of the organization.
 */
export async function allocateClientCid(tx: DbClient, organizationId: string): Promise<{ cid: string; sequence: number }> {
  await tx.$executeRaw`INSERT INTO organization_counters (organizationId, \`key\`, value) VALUES (${organizationId}, ${CLIENT_COUNTER_KEY}, 0) ON DUPLICATE KEY UPDATE value = value`;
  await tx.$executeRaw`UPDATE organization_counters SET value = value + 1 WHERE organizationId = ${organizationId} AND \`key\` = ${CLIENT_COUNTER_KEY}`;
  const rows = await tx.$queryRaw<Array<{ value: number | bigint }>>`SELECT value FROM organization_counters WHERE organizationId = ${organizationId} AND \`key\` = ${CLIENT_COUNTER_KEY}`;
  const raw = rows[0]?.value;
  const sequence = Number(raw ?? 0);
  if (!sequence) throw new Error("Failed to allocate client sequence");
  return { cid: formatCid(sequence), sequence };
}
