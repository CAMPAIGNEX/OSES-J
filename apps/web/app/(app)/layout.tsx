import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/server/session";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  return (
    <AppShell session={{ user: session.user, organization: session.organization, memberships: session.memberships }}>
      {children}
    </AppShell>
  );
}
