import type { Metadata } from "next";
import { OsSystem } from "@/components/os-panel/os-system";

export const metadata: Metadata = { title: "System · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsSystem />;
}
