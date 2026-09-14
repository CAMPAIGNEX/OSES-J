import type { Metadata } from "next";
import { Suspense } from "react";
import { AIAssistant } from "@/components/ai/ai-assistant";

export const metadata: Metadata = { title: "AI Assistant" };

export default function AIAssistantPage() {
  return (
    <Suspense fallback={null}>
      <AIAssistant />
    </Suspense>
  );
}
