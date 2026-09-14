import type { Metadata } from "next";
import { Suspense } from "react";
import { SocialSettings } from "@/components/settings/settings-pages";

export const metadata: Metadata = { title: "Social accounts" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SocialSettings />
    </Suspense>
  );
}
