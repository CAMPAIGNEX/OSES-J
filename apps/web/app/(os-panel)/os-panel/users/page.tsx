import type { Metadata } from "next";
import { OsUsers } from "@/components/os-panel/os-users";

export const metadata: Metadata = { title: "Users · OS-Panel", robots: { index: false } };

export default function Page() {
  return <OsUsers />;
}
