import type { DbClient, Prisma } from "@oses/database";
import type { ClientProfileForAI } from "@oses/ai";
import type { Platform } from "@oses/shared";

export type ClientWithRelations = Prisma.ClientGetPayload<{ include: { socialAccounts: true; tags: { include: { tag: true } }; notes: { where: { deletedAt: null }; orderBy: { createdAt: "desc" }; take: 5 } } }>;

export async function loadClientWithRelations(db: DbClient, organizationId: string, clientId: string): Promise<ClientWithRelations | null> {
  return db.client.findFirst({
    where: { id: clientId, organizationId },
    include: { socialAccounts: true, tags: { include: { tag: true } }, notes: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 5 } },
  });
}

/** Shape a CRM client into the profile the AI is allowed to see. */
export function toClientProfile(client: ClientWithRelations, channel?: Platform | null): ClientProfileForAI {
  const account = client.socialAccounts.find((a) => (channel ? a.platform === channel : true)) ?? client.socialAccounts[0] ?? null;
  const analysis = client.aiAnalysis as { summary?: string } | null;
  return {
    cid: client.cid,
    brandName: client.brandName,
    companyName: client.companyName,
    category: client.category ?? account?.category ?? null,
    website: client.website,
    country: client.country,
    region: client.region,
    city: client.city,
    followers: client.followers ?? account?.followers ?? null,
    bio: client.bio ?? account?.bio ?? null,
    platform: account?.platform ?? null,
    username: account?.username ?? null,
    status: client.status,
    tags: client.tags.map((t) => t.tag.name),
    notes: client.notes.map((n) => n.body).join("\n").slice(0, 1500) || null,
    analysisSummary: client.aiSummary ?? analysis?.summary ?? null,
  };
}
