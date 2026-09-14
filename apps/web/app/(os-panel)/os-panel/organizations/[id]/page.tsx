import type { Metadata } from "next";
import { OsOrganizationDetail } from "@/components/os-panel/os-organization-detail";

export const metadata: Metadata = { title: "Organization · OS-Panel", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OsOrganizationDetail id={id} />;
}
