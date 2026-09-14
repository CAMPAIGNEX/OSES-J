import { NextResponse } from "next/server";
import { getOrCreateSettings, writeAudit } from "@oses/database";
import { appearanceSettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { normalizeTemplate, TEMPLATE_COOKIE, UI_TEMPLATES } from "@/lib/templates";

export const GET = withApi(async (ctx) => {
  const settings = await getOrCreateSettings(ctx.db, ctx.organizationId);
  return { template: normalizeTemplate(settings.uiTemplate), templates: UI_TEMPLATES };
});

/** Workspace-wide UI template. Any member can switch it; the choice is mirrored into a cookie for a flash-free first paint. */
export const PUT = withApi(
  async (ctx) => {
    await getOrCreateSettings(ctx.db, ctx.organizationId);
    const template = normalizeTemplate(ctx.body.template);
    await ctx.db.organizationSettings.update({ where: { organizationId: ctx.organizationId }, data: { uiTemplate: template } });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.appearance_updated", meta: { template } });
    const res = NextResponse.json({ template });
    res.cookies.set(TEMPLATE_COOKIE, template, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
    return res;
  },
  { body: appearanceSettingsSchema },
);
