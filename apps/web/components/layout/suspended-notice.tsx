import { ShieldOff } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/primitives";

/** Shown instead of the workspace when the CNEX AI team has suspended it. */
export function SuspendedNotice({ organization, reason }: { organization: string; reason: string | null }) {
  return (
    <div className="mx-auto max-w-xl py-16">
      <EmptyState icon={<ShieldOff className="h-5 w-5" />} title={`${organization} is suspended`} description={reason ? `Reason: ${reason}. Contact support to restore access.` : "Contact support to restore access to this workspace."} />
    </div>
  );
}
