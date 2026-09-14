import { NextResponse } from "next/server";
import { buildOAuthUrl, createOAuthState, metaRedirectUri } from "@oses/messaging";
import { withApi } from "@/lib/server/api";

/** Starts the Meta OAuth flow (Facebook Login) for connecting Pages / Instagram professional accounts. */
export const GET = withApi(async (ctx) => {
  const state = createOAuthState(ctx.organizationId, ctx.userId);
  return NextResponse.redirect(buildOAuthUrl(metaRedirectUri(), state));
});
