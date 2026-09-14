import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { SuspendedNotice } from "@/components/layout/suspended-notice";
import { requireSession } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const suspended = session.organization.status === "SUSPENDED" && !session.user.isSuperAdmin;
  return (
    <AppShell session={{ user: session.user, organization: session.organization, memberships: session.memberships }}>
      {suspended ? <SuspendedNotice organization={session.organization.name} reason={session.organization.suspendedReason} /> : children}
    </AppShell>
  );
}
