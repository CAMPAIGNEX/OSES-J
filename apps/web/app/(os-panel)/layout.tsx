import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { OsShell } from "@/components/os-panel/os-shell";
import { getSession } from "@/lib/server/session";

/**
 * OS-Panel is strictly for CNEX AI operators. Everyone else, signed in or not, gets a 404
 * so the panel does not even appear to exist.
 */
export default async function OsPanelLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session?.user.isSuperAdmin) notFound();
  return <OsShell operator={{ name: session.user.name, email: session.user.email }}>{children}</OsShell>;
}
