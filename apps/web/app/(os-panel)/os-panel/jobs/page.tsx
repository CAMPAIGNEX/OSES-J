import type { Metadata } from "next";
import { OsJobs } from "@/components/os-panel/os-jobs";

export const metadata: Metadata = { title: "Jobs · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsJobs />;
}
