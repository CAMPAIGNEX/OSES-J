import type { Metadata } from "next";
import { SearchResults } from "@/components/leads/search-results";

export const metadata: Metadata = { title: "Search results" };

export default async function SearchRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <SearchResults runId={runId} />;
}
