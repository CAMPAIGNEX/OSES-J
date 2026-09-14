import { addClientNote } from "@oses/crm";
import { noteSchema } from "@oses/validation";
import { serviceContext, withApi } from "@/lib/server/api";

export const POST = withApi(async (ctx) => ({ note: await addClientNote(ctx.db, serviceContext(ctx), ctx.params.cid ?? "", ctx.body.body) }), { body: noteSchema });
