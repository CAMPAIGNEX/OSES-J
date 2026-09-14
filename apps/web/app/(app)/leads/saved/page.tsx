import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedLeads } from "@/components/leads/saved-leads";

export const metadata: Metadata = { title: "Saved Leads" };

export default function SavedLeadsPage() {
  return (
    <Suspense fallback={null}>
      <SavedLeads />
    </Suspense>
  );
}
