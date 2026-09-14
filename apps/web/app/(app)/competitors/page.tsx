import type { Metadata } from "next";
import { AnalysisList } from "@/components/analysis/analysis";

export const metadata: Metadata = { title: "Competitor Analysis" };

export default function Page() {
  return <AnalysisList kind="competitors" />;
}
