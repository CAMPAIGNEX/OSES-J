import { NextResponse } from "next/server";
import { db, writeAudit } from "@oses/database";
import { AuthError, verifyPassword } from "@oses/shared";
import { loginSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

export const POST = withApi(
  async ({ body, req, ip }) => {
    const user = await db.user.findUnique({ where: { email: body.email }, include: { memberships: { orderBy: { createdAt: "asc" }, take: 1 } } });
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid || !user.isActive) {
      await writeAudit(db, { userId: user?.id ?? null, action: "auth.login_failed", ip, meta: { email: body.email } });
      throw new AuthError("Incorrect email or password");
    }
    const orgId = user.memberships[0]?.organizationId ?? null;
    const { token, expiresAt } = await createSession({ userId: user.id, organizationId: orgId, userAgent: req.headers.get("user-agent"), ip });
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await writeAudit(db, { organizationId: orgId, userId: user.id, action: "auth.login", ip, userAgent: req.headers.get("user-agent") });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  },
  { auth: false, body: loginSchema, rateLimit: { key: "login", limit: 15, windowMs: 60_000 } },
);
