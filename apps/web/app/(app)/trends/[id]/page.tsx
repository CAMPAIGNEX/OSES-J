import type { Metadata } from "next";
import { AnalysisDetail } from "@/components/analysis/analysis";

export const metadata: Metadata = { title: "Trend Analysis" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AnalysisDetail kind="trends" id={id} />;
}
