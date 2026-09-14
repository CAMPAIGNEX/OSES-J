import type { Metadata } from "next";
import { CampaignDetailView } from "@/components/campaigns/campaigns";

export const metadata: Metadata = { title: "Campaign" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CampaignDetailView id={id} />;
}
