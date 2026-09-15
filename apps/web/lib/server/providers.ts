/**
 * Actor configuration rows exist at two levels: per workspace (organizationId set) and platform-wide
 * (organizationId = null, inherited by every workspace). `?scope=platform` targets the platform rows;
 * the routes using it are operator-only.
 */
export function providerScope(ctx: { query: URLSearchParams; organizationId: string }): string | null {
  return ctx.query.get("scope") === "platform" ? null : ctx.organizationId;
}
