import { redirect } from "next/navigation";

export default function Page() {
  redirect("/ai-assistant?tab=autopilot");
}
