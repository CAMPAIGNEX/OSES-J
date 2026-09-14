import type { Metadata } from "next";
import { OsOrganizations } from "@/components/os-panel/os-organizations";

export const metadata: Metadata = { title: "Organizations · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsOrganizations />;
}
