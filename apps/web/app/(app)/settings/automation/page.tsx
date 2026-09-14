import type { Metadata } from "next";
import { AutomationSettings } from "@/components/settings/settings-pages";

export const metadata: Metadata = { title: "Automation settings" };

export default function Page() {
  return <AutomationSettings />;
}
