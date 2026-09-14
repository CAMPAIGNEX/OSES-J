import { listTrash } from "@oses/automation";
import { trashListQuerySchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => listTrash(ctx.db, serviceContext(ctx), parseQuery(ctx.query, trashListQuerySchema)));
