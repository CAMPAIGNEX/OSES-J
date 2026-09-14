import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="app-backdrop" aria-hidden />
      <Link href="/" className="relative z-[1] mb-8 flex items-center gap-3" aria-label="OSES-J website">
        <span data-ui="brand-mark" className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
          <Image src="/brand/oses-j-mark.svg" alt="" width={24} height={24} className="h-6 w-6 brightness-0 invert" priority />
        </span>
        <Image src="/brand/oses-j-wordmark.svg" alt="OSES-J" width={150} height={20} className="h-5 w-auto dark:brightness-0 dark:invert" priority />
      </Link>
      <div className="relative z-[1] w-full max-w-[420px]">{children}</div>
      <p className="relative z-[1] mt-8 text-center text-xs text-faint">
        AI-powered social export sales system ·{" "}
        <Link href="/docs/getting-started" className="underline underline-offset-2 hover:text-body">
          Manual
        </Link>{" "}
        ·{" "}
        <Link href="/" className="underline underline-offset-2 hover:text-body">
          Website
        </Link>
      </p>
    </div>
  );
}
