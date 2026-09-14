import { switchOrganizationSchema } from "@oses/validation";
import { withApi } from "@/lib/server/api";
import { switchActiveOrganization } from "@/lib/server/session";

export const POST = withApi(
  async ({ body, session }) => {
    await switchActiveOrganization(session.sessionId, session.user.id, body.organizationId);
    return { ok: true };
  },
  { body: switchOrganizationSchema },
);
