import type { Metadata } from "next";
import { TrashView } from "@/components/trash/trash";

export const metadata: Metadata = { title: "Trash" };

export default function Page() {
  return <TrashView />;
}
