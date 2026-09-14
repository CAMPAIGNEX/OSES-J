import { NextResponse } from "next/server";
import { completeMetaConnection, parseOAuthState } from "@oses/messaging";
import { errorMessage, getEnv } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const base = getEnv().APP_URL.replace(/\/$/, "");
  const code = ctx.query.get("code");
  const state = ctx.query.get("state");
  const denied = ctx.query.get("error") ?? ctx.query.get("error_description");
  const parsed = state ? parseOAuthState(state) : null;
  if (!parsed || parsed.organizationId !== ctx.organizationId || parsed.userId !== ctx.userId) {
    return NextResponse.redirect(`${base}/settings/social?error=${encodeURIComponent("Invalid or expired OAuth state. Please try connecting again.")}`);
  }
  if (denied || !code) return NextResponse.redirect(`${base}/settings/social?error=${encodeURIComponent(denied ?? "Meta did not return an authorization code")}`);
  try {
    const result = await completeMetaConnection(ctx.db, ctx.organizationId, ctx.userId, code);
    const params = new URLSearchParams({ connected: String(result.connections.length) });
    if (result.warnings.length) params.set("warning", result.warnings.join(" "));
    return NextResponse.redirect(`${base}/settings/social?${params.toString()}`);
  } catch (err) {
    return NextResponse.redirect(`${base}/settings/social?error=${encodeURIComponent(errorMessage(err))}`);
  }
});
