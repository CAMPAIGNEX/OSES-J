import type { Metadata } from "next";
import { PerformanceView } from "@/components/performance/performance";

export const metadata: Metadata = { title: "Performance" };

export default function Page() {
  return <PerformanceView />;
}
