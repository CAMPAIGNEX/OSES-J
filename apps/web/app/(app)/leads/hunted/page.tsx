import type { Metadata } from "next";
import { Suspense } from "react";
import { SavedLeads } from "@/components/leads/saved-leads";

export const metadata: Metadata = { title: "Hunted Leads" };

export default function HuntedLeadsPage() {
  return (
    <Suspense fallback={null}>
      <SavedLeads mode="hunted" />
    </Suspense>
  );
}
