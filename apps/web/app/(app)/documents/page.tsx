import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsView } from "@/components/documents/documents";

export const metadata: Metadata = { title: "Documents" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentsView />
    </Suspense>
  );
}
