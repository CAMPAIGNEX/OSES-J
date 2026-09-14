import type { Metadata } from "next";
import { ProvidersSettings } from "@/components/settings/settings-pages";

export const metadata: Metadata = { title: "Providers" };

export default function Page() {
  return <ProvidersSettings />;
}
