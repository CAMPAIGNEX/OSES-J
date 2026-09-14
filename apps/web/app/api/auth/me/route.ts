import { withApi } from "@/lib/server/api";

export const GET = withApi(async ({ session }) => ({ user: session.user, organization: session.organization, memberships: session.memberships }));
