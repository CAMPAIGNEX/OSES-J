import type { Metadata } from "next";
import { CompanySettings } from "@/components/settings/settings-pages";

export const metadata: Metadata = { title: "Company settings" };

export default function Page() {
  return <CompanySettings />;
}
