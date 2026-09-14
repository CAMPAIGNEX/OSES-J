import { NextResponse } from "next/server";
import { db, writeAudit } from "@oses/database";
import { ConflictError, hashPassword, slugify, randomCode, DEFAULT_FOLLOW_UP_DAYS } from "@oses/shared";
import { registerSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

/** Creates the user, their exporter organization (as OWNER) and signs them in. */
export const POST = withApi(
  async ({ body, req, ip }) => {
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ConflictError("An account with this email already exists", { field: "email" });
    const passwordHash = await hashPassword(body.password);
    const baseSlug = slugify(body.companyName).slice(0, 60) || "organization";
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email: body.email, name: body.name, passwordHash } });
      let slug = baseSlug;
      while (await tx.organization.findUnique({ where: { slug } })) slug = `${baseSlug}-${randomCode(4).toLowerCase()}`;
      const org = await tx.organization.create({ data: { name: body.companyName, slug, timezone: "Asia/Karachi" } });
      await tx.organizationMember.create({ data: { organizationId: org.id, userId: user.id, role: "OWNER" } });
      await tx.organizationCounter.create({ data: { organizationId: org.id, key: "client_cid", value: 0 } });
      await tx.organizationSettings.create({ data: { organizationId: org.id, followUpDays: DEFAULT_FOLLOW_UP_DAYS, workingHours: { enabled: false, start: "10:00", end: "17:00", days: [1, 2, 3, 4, 5], timezoneMode: "client" } } });
      return { user, org };
    });
    await writeAudit(db, { organizationId: result.org.id, userId: result.user.id, action: "auth.register", ip, userAgent: req.headers.get("user-agent") });
    const { token, expiresAt } = await createSession({ userId: result.user.id, organizationId: result.org.id, userAgent: req.headers.get("user-agent"), ip });
    const res = NextResponse.json({ ok: true, organization: { id: result.org.id, name: result.org.name } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  },
  { auth: false, body: registerSchema, rateLimit: { key: "register", limit: 10, windowMs: 60_000 } },
);
