import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { MemberRole } from "@oses/database";
import { db, writeAudit } from "@oses/database";
import { addDays, AuthError, getEnv, randomToken, sha256Hex } from "@oses/shared";

export const SESSION_COOKIE = "oses_session";
const SESSION_DAYS = 30;
const RENEW_AFTER_MS = 10 * 60_000;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  timezone: string | null;
  /** Platform operator (CNEX AI team): OS-Panel access across all organizations. */
  isSuperAdmin: boolean;
}

export interface SessionOrganization {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  timezone: string;
  status: "ACTIVE" | "SUSPENDED";
  suspendedReason: string | null;
  uiTemplate: string;
}

export interface SessionContext {
  sessionId: string;
  user: SessionUser;
  organization: SessionOrganization;
  memberships: Array<{ id: string; name: string; slug: string; role: MemberRole }>;
}

/** Emails listed in SUPER_ADMIN_EMAILS are operators even before the flag is persisted (bootstrap). */
export function isBootstrapSuperAdmin(email: string): boolean {
  const list = getEnv().SUPER_ADMIN_EMAILS;
  if (!list) return false;
  const wanted = email.trim().toLowerCase();
  return list.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean).includes(wanted);
}

export function sessionCookieOptions(expires: Date) {
  const env = getEnv();
  return { httpOnly: true, sameSite: "lax" as const, secure: env.isProduction || env.APP_URL.startsWith("https://"), path: "/", expires };
}

/** Create a DB session and return the raw token (only ever sent to the browser as an HttpOnly cookie). */
export async function createSession(input: { userId: string; organizationId: string | null; userAgent?: string | null; ip?: string | null }): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32);
  const expiresAt = addDays(new Date(), SESSION_DAYS);
  await db.session.create({ data: { userId: input.userId, tokenHash: sha256Hex(token), activeOrganizationId: input.organizationId, userAgent: input.userAgent?.slice(0, 255) ?? null, ip: input.ip?.slice(0, 64) ?? null, expiresAt } });
  return { token, expiresAt };
}

export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  await db.session.deleteMany({ where: { tokenHash: sha256Hex(token) } });
}

async function loadSession(token: string | undefined | null): Promise<SessionContext | null> {
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: sha256Hex(token) }, include: { user: { include: { memberships: { include: { organization: { include: { settings: { select: { uiTemplate: true } } } } } } } } } });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;
  const memberships = session.user.memberships.filter((m) => !m.organization.deletedAt);
  if (!memberships.length) return null;
  const isSuperAdmin = session.user.isSuperAdmin || isBootstrapSuperAdmin(session.user.email);
  const active = memberships.find((m) => m.organizationId === session.activeOrganizationId) ?? memberships[0]!;
  if (session.activeOrganizationId !== active.organizationId || Date.now() - session.lastSeenAt.getTime() > RENEW_AFTER_MS) {
    await db.session.update({ where: { id: session.id }, data: { activeOrganizationId: active.organizationId, lastSeenAt: new Date(), expiresAt: addDays(new Date(), SESSION_DAYS) } }).catch(() => undefined);
  }
  return {
    sessionId: session.id,
    user: { id: session.user.id, email: session.user.email, name: session.user.name, timezone: session.user.timezone, isSuperAdmin },
    organization: { id: active.organization.id, name: active.organization.name, slug: active.organization.slug, role: active.role, timezone: active.organization.timezone, status: active.organization.status, suspendedReason: active.organization.suspendedReason, uiTemplate: active.organization.settings?.uiTemplate ?? "classic" },
    memberships: memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, slug: m.organization.slug, role: m.role })),
  };
}

/** Session from the incoming request cookies (route handlers). */
export async function getSessionFromRequest(req: Request): Promise<SessionContext | null> {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  const token = match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
  return loadSession(token);
}

/** Session for server components (uses next/headers). */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  return loadSession(store.get(SESSION_COOKIE)?.value);
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireSessionFromRequest(req: Request): Promise<SessionContext> {
  const session = await getSessionFromRequest(req);
  if (!session) throw new AuthError();
  return session;
}

export async function switchActiveOrganization(sessionId: string, userId: string, organizationId: string): Promise<void> {
  const membership = await db.organizationMember.findFirst({ where: { userId, organizationId } });
  if (!membership) throw new AuthError("You are not a member of that organization");
  await db.session.update({ where: { id: sessionId }, data: { activeOrganizationId: organizationId } });
  await writeAudit(db, { organizationId, userId, action: "auth.switch_organization" });
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null }> {
  const h = await headers();
  return { ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null, userAgent: h.get("user-agent") };
}
