import { NextResponse } from "next/server";
import { getPlatformConfig } from "@oses/database";
import { buildOAuthUrl, createOAuthState, metaRedirectUri } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

/** Starts the Meta OAuth flow (Facebook Login) for connecting Pages / Instagram professional accounts. */
export const GET = withApi(async (ctx) => {
  const state = createOAuthState(ctx.organizationId, ctx.userId);
  const { meta } = await getPlatformConfig(ctx.db);
  return NextResponse.redirect(buildOAuthUrl(meta, metaRedirectUri(), state));
});
