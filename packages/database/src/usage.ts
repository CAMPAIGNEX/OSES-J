import type { UsageMetric } from "../generated/prisma/enums";
import type { DbClient } from "./client";

/** Increment a daily usage counter (billing-ready metering). Never throws. */
export async function recordUsage(tx: DbClient, organizationId: string, metric: UsageMetric, quantity = 1, at: Date = new Date()): Promise<void> {
  if (quantity <= 0) return;
  const day = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  try {
    await tx.usageRecord.upsert({
      where: { organizationId_metric_day: { organizationId, metric, day } },
      create: { organizationId, metric, day, quantity },
      update: { quantity: { increment: quantity } },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("usage record write failed", err);
  }
}
