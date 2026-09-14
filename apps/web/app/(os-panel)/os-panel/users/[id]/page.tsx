import type { Metadata } from "next";
import { OsUserDetail } from "@/components/os-panel/os-user-detail";

export const metadata: Metadata = { title: "User · OS-Panel", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OsUserDetail id={id} />;
}
