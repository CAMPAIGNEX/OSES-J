import type { Metadata } from "next";
import { ClientProfile } from "@/components/clients/client-profile";

export async function generateMetadata({ params }: { params: Promise<{ cid: string }> }): Promise<Metadata> {
  const { cid } = await params;
  return { title: cid.toUpperCase() };
}

export default async function ClientPage({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  return <ClientProfile cid={cid} />;
}
