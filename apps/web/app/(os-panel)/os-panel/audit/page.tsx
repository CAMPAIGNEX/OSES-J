import type { Metadata } from "next";
import { OsAudit } from "@/components/os-panel/os-audit";

export const metadata: Metadata = { title: "Audit log · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsAudit />;
}
