import type { Metadata } from "next";
import { AnalysisList } from "@/components/analysis/analysis";

export const metadata: Metadata = { title: "Trend Analysis" };

export default function Page() {
  return <AnalysisList kind="trends" />;
}
