import { redirect } from "next/navigation";

/** Provider configuration moved to the OS-Panel (operators); members see service readiness under Automation. */
export default function Page() {
  redirect("/settings/automation");
}
