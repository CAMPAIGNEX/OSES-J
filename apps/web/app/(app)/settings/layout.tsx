import type { ReactNode } from "react";
import { SettingsLayout } from "@/components/settings/settings-pages";

export default function Layout({ children }: { children: ReactNode }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
