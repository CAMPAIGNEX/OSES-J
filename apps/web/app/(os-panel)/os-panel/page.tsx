import type { Metadata } from "next";
import { OsOverview } from "@/components/os-panel/os-overview";

export const metadata: Metadata = { title: "OS-Panel", robots: { index: false, follow: false } };

export default function Page() {
  return <OsOverview />;
}
