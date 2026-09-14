import { ApifyClient } from "@oses/apify";
import { resolveApifyToken } from "@oses/discovery";
import { errorMessage } from "@oses/shared";
import { z } from "zod";
import { withApi } from "@/lib/server/api";

/** Validate the Apify token (and optionally that an Actor exists) without running anything. */
export const POST = withApi(
  async (ctx) => {
    const { token, origin } = await resolveApifyToken(ctx.db, ctx.organizationId);
    if (!token) return { ok: false, error: "No Apify token configured" };
    try {
      const client = new ApifyClient({ token });
      const me = await client.getMe();
      let actor: { id: string; name: string; username: string; title?: string; isDeprecated?: boolean } | null = null;
      if (ctx.body.actorId) actor = await client.getActor(ctx.body.actorId);
      return { ok: true, account: me.username, origin, actor: actor ? { id: actor.id, name: `${actor.username}/${actor.name}`, title: actor.title ?? null, deprecated: actor.isDeprecated ?? false } : null };
    } catch (err) {
      return { ok: false, error: errorMessage(err), origin };
    }
  },
  { body: z.object({ actorId: z.string().trim().max(200).optional() }), superAdminOnly: true, operatorOrgOverride: true },
);
