import "server-only";
import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { db, type PrismaClient } from "@oses/database";
import { AppError, AuthError, NotFoundError, createLogger, errorMessage, ForbiddenError, getEnv, RateLimitError, ValidationError } from "@oses/shared";
import { getSessionFromRequest, type SessionContext } from "./session";

const log = createLogger("api");

export interface ApiContext<TBody = unknown> {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  body: TBody;
  db: PrismaClient;
  ip: string | null;
  /** Present when the route requires (or optionally has) a session. */
  session: SessionContext;
  organizationId: string;
  userId: string;
}

export interface ApiOptions<TBody> {
  /** default true: require a signed-in user with an active organization */
  auth?: boolean;
  /** Zod schema for the JSON body (POST/PUT/PATCH) */
  body?: ZodType<TBody>;
  /** Zod schema applied to query params (parsed into an object) */
  query?: ZodType;
  /** Require OWNER/ADMIN role */
  adminOnly?: boolean;
  /** Require a platform operator (OS-Panel); ignores organization scoping */
  superAdminOnly?: boolean;
  /** Allow the request even when the active organization is suspended (default false) */
  allowSuspended?: boolean;
  /** Skip the same-origin check (only for endpoints authenticated by bearer tokens or signatures) */
  skipCsrf?: boolean;
  /** Simple per-IP limit for unauthenticated endpoints */
  rateLimit?: { key: string; limit: number; windowMs: number };
}

type RouteContext = { params: Promise<Record<string, string>> } | { params: Record<string, string> } | undefined;

// ---------- in-memory rate limiter (per process; good enough for auth endpoints) ----------
const buckets = new Map<string, number[]>();
export function checkRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) throw new RateLimitError("Too many attempts. Please wait a moment and try again.");
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
}

function assertSameOrigin(req: Request): void {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return;
  const origin = req.headers.get("origin");
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return;
  if (!origin) {
    // Non-browser clients (curl) have no Origin header; they also cannot carry a browser cookie via CSRF.
    if (fetchSite === null) return;
    throw new ForbiddenError("Missing Origin header");
  }
  const appOrigin = new URL(getEnv().APP_URL).origin;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError("Invalid Origin header");
  }
  if (origin !== appOrigin && originHost !== host) throw new ForbiddenError("Cross-site request blocked");
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    if (err.status >= 500) log.error("request failed", { code: err.code, message: err.message, cause: err.cause instanceof Error ? err.cause.message : undefined });
    return NextResponse.json({ error: err.toJSON() }, { status: err.status });
  }
  log.error("unhandled error", { error: errorMessage(err), stack: err instanceof Error ? err.stack : undefined });
  const message = getEnv().isProduction ? "Something went wrong" : errorMessage(err);
  return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

async function parseBody<T>(req: Request, schema: ZodType<T> | undefined): Promise<T> {
  if (!schema) return undefined as T;
  const type = req.headers.get("content-type") ?? "";
  let raw: unknown = {};
  if (type.includes("application/json")) {
    const text = await req.text();
    if (text.trim()) {
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ValidationError("Request body must be valid JSON");
      }
    }
  } else if (type.includes("form")) {
    const form = await req.formData();
    raw = Object.fromEntries(form.entries());
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError("Please check the highlighted fields", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  return parsed.data;
}

export function parseQuery<T>(query: URLSearchParams, schema: ZodType<T>): T {
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of query.entries()) {
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else obj[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  const parsed = schema.safeParse(obj);
  if (!parsed.success) throw new ValidationError("Invalid query parameters", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  return parsed.data;
}

/**
 * Route handler wrapper: session + organization scoping, validation, CSRF, rate limiting and
 * consistent error responses. Every API route in the app goes through this.
 */
export function withApi<TBody = unknown>(handler: (ctx: ApiContext<TBody>) => Promise<Response | unknown>, options: ApiOptions<TBody> = {}) {
  return async (req: Request, routeCtx?: RouteContext): Promise<Response> => {
    try {
      const params = routeCtx?.params ? await routeCtx.params : {};
      const url = new URL(req.url);
      const ip = clientIp(req);
      if (options.rateLimit) checkRateLimit(`${options.rateLimit.key}:${ip ?? "unknown"}`, options.rateLimit.limit, options.rateLimit.windowMs);
      if (!options.skipCsrf) assertSameOrigin(req);
      let session: SessionContext | null = null;
      if (options.auth !== false) {
        session = await getSessionFromRequest(req);
        if (!session) throw new AuthError();
        if (options.adminOnly && session.organization.role === "MEMBER") throw new ForbiddenError("Administrator access required");
        if (options.superAdminOnly && !session.user.isSuperAdmin) throw new NotFoundError("Page");
        if (!options.superAdminOnly && !options.allowSuspended && session.organization.status === "SUSPENDED" && !session.user.isSuperAdmin) {
          throw new AppError("ORG_SUSPENDED", `This workspace is suspended${session.organization.suspendedReason ? `: ${session.organization.suspendedReason}` : ""}. Contact support.`, { status: 403, errorClass: "PERMANENT" });
        }
      }
      const body = await parseBody<TBody>(req, options.body);
      if (options.query) parseQuery(url.searchParams, options.query);
      const ctx: ApiContext<TBody> = {
        req,
        params,
        query: url.searchParams,
        body,
        db,
        ip,
        session: session as SessionContext,
        organizationId: session?.organization.id ?? "",
        userId: session?.user.id ?? "",
      };
      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Wrapper variant for the browser-extension endpoints (bearer token auth, no cookies/CSRF). */
export function withExtensionApi<TBody = unknown>(handler: (ctx: Omit<ApiContext<TBody>, "session" | "organizationId" | "userId"> & { token: string }) => Promise<Response | unknown>, options: { body?: ZodType<TBody>; rateLimit?: ApiOptions<TBody>["rateLimit"] } = {}) {
  return async (req: Request, routeCtx?: RouteContext): Promise<Response> => {
    try {
      const params = routeCtx?.params ? await routeCtx.params : {};
      const url = new URL(req.url);
      const ip = clientIp(req);
      if (options.rateLimit) checkRateLimit(`${options.rateLimit.key}:${ip ?? "unknown"}`, options.rateLimit.limit, options.rateLimit.windowMs);
      const auth = req.headers.get("authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const body = await parseBody<TBody>(req, options.body);
      const result = await handler({ req, params, query: url.searchParams, body, db, ip, token });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Request context passed to domain services. */
export function serviceContext(ctx: Pick<ApiContext, "organizationId" | "userId">): { organizationId: string; userId: string | null } {
  return { organizationId: ctx.organizationId, userId: ctx.userId || null };
}
