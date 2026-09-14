import type { Metadata } from "next";
import { MessagingSettingsPage } from "@/components/settings/settings-pages";

export const metadata: Metadata = { title: "Messaging settings" };

export default function Page() {
  return <MessagingSettingsPage />;
}
