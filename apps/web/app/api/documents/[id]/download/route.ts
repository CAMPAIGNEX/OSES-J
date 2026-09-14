import { getStorage, NotFoundError } from "@oses/shared";
import { withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => {
  const doc = await ctx.db.document.findFirst({ where: { id: ctx.params.id ?? "", organizationId: ctx.organizationId } });
  if (!doc) throw new NotFoundError("Document");
  const data = await getStorage().get(doc.storageKey);
  const inline = ctx.query.get("inline") === "1" && /^(image\/|application\/pdf|text\/)/.test(doc.mimeType);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(doc.originalName)}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
