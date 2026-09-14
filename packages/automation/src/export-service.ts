import type { DbClient, Prisma } from "@oses/database";
import { recordUsage, writeAudit } from "@oses/database";
import { buildLeadWhere } from "@oses/discovery";
import { buildStorageKey, getStorage } from "@oses/shared";
import type { LeadListQuery } from "@oses/validation";
import ExcelJS from "exceljs";

export const EXPORT_COLUMNS = [
  { header: "CID", key: "cid", width: 12 },
  { header: "Brand", key: "brand", width: 28 },
  { header: "Platform", key: "platform", width: 12 },
  { header: "Username", key: "username", width: 22 },
  { header: "Profile URL", key: "profileUrl", width: 40 },
  { header: "Inbox URL", key: "inboxUrl", width: 40 },
  { header: "Followers", key: "followers", width: 12 },
  { header: "Email", key: "email", width: 28 },
  { header: "Phone", key: "phone", width: 18 },
  { header: "WhatsApp", key: "whatsapp", width: 18 },
  { header: "Website", key: "website", width: 32 },
  { header: "Country", key: "country", width: 14 },
  { header: "Region", key: "region", width: 14 },
  { header: "City", key: "city", width: 16 },
  { header: "Address", key: "address", width: 30 },
  { header: "Category", key: "category", width: 18 },
  { header: "Lead Score", key: "leadScore", width: 11 },
  { header: "Source", key: "source", width: 14 },
  { header: "Created At", key: "createdAt", width: 20 },
] as const;

export interface ExportRow {
  cid: string | null;
  brand: string;
  platform: string | null;
  username: string | null;
  profileUrl: string | null;
  inboxUrl: string | null;
  followers: number | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  category: string | null;
  leadScore: number | null;
  source: string | null;
  createdAt: string;
}

/** Build an XLSX workbook (Excel-compatible) from rows. */
export async function buildXlsx(rows: ExportRow[], sheetName = "Leads"): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OSES-J";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = EXPORT_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: EXPORT_COLUMNS.length } };
  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export async function leadRowsForExport(db: DbClient, organizationId: string, input: { leadIds?: string[]; filters?: Partial<LeadListQuery> }): Promise<ExportRow[]> {
  const where: Prisma.LeadWhereInput = input.leadIds?.length
    ? { organizationId, id: { in: input.leadIds }, deletedAt: null }
    : buildLeadWhere(organizationId, { page: 1, pageSize: 25, sort: "score", order: "desc", ...(input.filters ?? {}) } as LeadListQuery);
  const leads = await db.lead.findMany({ where, orderBy: { leadScore: "desc" }, take: 5000, include: { client: { select: { cid: true } } } });
  return leads.map((l) => ({
    cid: l.client?.cid ?? null,
    brand: l.brandName,
    platform: l.primaryPlatform,
    username: l.username,
    profileUrl: l.profileUrl,
    inboxUrl: l.inboxUrl,
    followers: l.followers,
    email: l.email,
    phone: l.phone,
    whatsapp: l.whatsapp,
    website: l.website,
    country: l.country,
    region: l.region,
    city: l.city,
    address: l.address,
    category: l.category,
    leadScore: l.leadScore,
    source: l.source,
    createdAt: l.createdAt.toISOString(),
  }));
}

export async function clientRowsForExport(db: DbClient, organizationId: string, clientIds?: string[]): Promise<ExportRow[]> {
  const clients = await db.client.findMany({ where: { organizationId, deletedAt: null, ...(clientIds?.length ? { id: { in: clientIds } } : {}) }, include: { socialAccounts: true }, orderBy: { cidSequence: "asc" }, take: 5000 });
  return clients.map((c) => {
    const account = c.socialAccounts[0];
    return {
      cid: c.cid,
      brand: c.brandName,
      platform: account?.platform ?? null,
      username: account?.username ?? null,
      profileUrl: account?.profileUrl ?? null,
      inboxUrl: account?.inboxUrl ?? null,
      followers: c.followers ?? account?.followers ?? null,
      email: c.email,
      phone: c.phone,
      whatsapp: c.whatsapp,
      website: c.website,
      country: c.country,
      region: c.region,
      city: c.city,
      address: c.address,
      category: c.category,
      leadScore: c.leadScore,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
    };
  });
}

/** Store an export as a Document (kind EXPORT) so large exports can be downloaded later. */
export async function storeExportDocument(db: DbClient, organizationId: string, userId: string | null, name: string, data: Buffer): Promise<{ documentId: string }> {
  const key = buildStorageKey(organizationId, "exports", name);
  const stored = await getStorage().put(key, data);
  const doc = await db.document.create({
    data: { organizationId, name, originalName: name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", sizeBytes: stored.sizeBytes, storageKey: stored.key, storageDriver: getStorage().driver, kind: "EXPORT", uploadedByUserId: userId, checksum: stored.checksum },
  });
  await recordUsage(db, organizationId, "EXPORTS", 1);
  await recordUsage(db, organizationId, "STORAGE_BYTES", stored.sizeBytes);
  await writeAudit(db, { organizationId, userId, action: "export.created", entityType: "Document", entityId: doc.id, meta: { name, sizeBytes: stored.sizeBytes } });
  return { documentId: doc.id };
}
