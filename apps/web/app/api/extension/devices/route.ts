import { listDevices } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => ({ items: await listDevices(ctx.db, ctx.organizationId) }));
