import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/app-shell";
import { SearchForm } from "@/components/leads/search-form";
import { FeatureGuide } from "@/components/layout/feature-guide";

export const metadata: Metadata = { title: "Search Leads" };

export default function SearchLeadsPage() {
  return (
    <div className="animate-in">
      <PageHeader title="Search Leads" description="Discover Instagram and Facebook brands that could buy your production. Describe who you are looking for; OSES-J finds, de-duplicates and enriches them." />
      <FeatureGuide id="search-leads" />
      <SearchForm />
    </div>
  );
}
