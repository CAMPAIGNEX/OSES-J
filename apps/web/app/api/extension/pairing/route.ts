import { createPairingCode } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

/** Web app: generate a short-lived pairing code to enter in the extension. */
export const POST = withApi(async (ctx) => createPairingCode(ctx.db, ctx.organizationId, ctx.userId));
