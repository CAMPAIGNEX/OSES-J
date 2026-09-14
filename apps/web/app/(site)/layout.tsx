import type { ReactNode } from "react";
import { SiteShell } from "@/components/site/site-shell";
import { getSession } from "@/lib/server/session";

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  return <SiteShell signedIn={Boolean(session)}>{children}</SiteShell>;
}
