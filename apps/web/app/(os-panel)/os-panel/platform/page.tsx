import type { Metadata } from "next";
import { OsPlatform } from "@/components/os-panel/os-platform";

export const metadata: Metadata = { title: "Providers & keys · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsPlatform />;
}
