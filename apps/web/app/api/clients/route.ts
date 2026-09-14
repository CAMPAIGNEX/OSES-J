import { createClientManually, listClients } from "@oses/crm";
import { clientListQuerySchema, createClientSchema } from "@oses/validation";
import { parseQuery, serviceContext, withApi } from "@/lib/server/api";

export const GET = withApi(async (ctx) => listClients(ctx.db, serviceContext(ctx), parseQuery(ctx.query, clientListQuerySchema)));

export const POST = withApi(async (ctx) => ({ client: await createClientManually(ctx.db, serviceContext(ctx), ctx.body) }), { body: createClientSchema });
