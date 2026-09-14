import type { ReactNode } from "react";
import { Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
          <Zap className="h-5 w-5" />
        </span>
        <span className="text-xl font-semibold tracking-tight">OSES J</span>
      </div>
      <div className="w-full max-w-[420px]">{children}</div>
      <p className="mt-8 text-center text-xs text-faint">AI-powered social export sales system</p>
    </div>
  );
}
