import { writeAudit } from "@oses/database";
import { normalizeUrl } from "@oses/shared";
import { companySettingsSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";

const select = { id: true, name: true, slug: true, description: true, website: true, country: true, city: true, address: true, products: true, moq: true, certifications: true, shippingInfo: true, productionCapacity: true, contactEmail: true, contactPhone: true, timezone: true };

export const GET = withApi(async (ctx) => ({ company: await ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.organizationId }, select }) }));

export const PUT = withApi(
  async (ctx) => {
    const b = ctx.body;
    const company = await ctx.db.organization.update({
      where: { id: ctx.organizationId },
      data: { name: b.name, description: b.description, website: normalizeUrl(b.website), country: b.country, city: b.city, address: b.address, products: b.products, moq: b.moq, certifications: b.certifications, shippingInfo: b.shippingInfo, productionCapacity: b.productionCapacity, contactEmail: b.contactEmail, contactPhone: b.contactPhone, ...(b.timezone ? { timezone: b.timezone } : {}) },
      select,
    });
    await writeAudit(ctx.db, { organizationId: ctx.organizationId, userId: ctx.userId, action: "settings.company_updated" });
    return { company };
  },
  { body: companySettingsSchema, adminOnly: true },
);
