import { NextResponse } from "next/server";
import { db } from "@oses/database";
import { switchOrganizationSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { switchActiveOrganization } from "@/lib/server/session";
import { normalizeTemplate, TEMPLATE_COOKIE } from "@/lib/templates";

export const POST = withApi(
  async ({ body, session }) => {
    await switchActiveOrganization(session.sessionId, session.user.id, body.organizationId);
    const settings = await db.organizationSettings.findUnique({ where: { organizationId: body.organizationId }, select: { uiTemplate: true } });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(TEMPLATE_COOKIE, normalizeTemplate(settings?.uiTemplate), { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  },
  { body: switchOrganizationSchema, allowSuspended: true },
);
