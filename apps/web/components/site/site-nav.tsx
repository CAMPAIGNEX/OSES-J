"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

export function SiteNav({ links, signedIn }: { links: Array<{ href: string; label: string }>; signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const items = links.map((l) => {
    const active = pathname === l.href || pathname.startsWith(l.href + "/");
    return (
      <Link key={l.href} href={l.href} className={cn("px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors", active ? "bg-bauhaus-yellow text-ink" : "hover:bg-surface-2")} aria-current={active ? "page" : undefined}>
        {l.label}
      </Link>
    );
  });

  const cta = signedIn ? (
    <Link href="/dashboard" data-ui="button" data-variant="primary" className="inline-flex h-9 items-center px-4 text-[12px]">
      Open app
    </Link>
  ) : (
    <>
      <Link href="/login" data-ui="button" data-variant="outline" className="inline-flex h-9 items-center px-4 text-[12px]">
        Sign in
      </Link>
      <Link href="/register" data-ui="button" data-variant="primary" className="inline-flex h-9 items-center px-4 text-[12px]">
        Get started
      </Link>
    </>
  );

  return (
    <>
      <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Site">
        {items}
      </nav>
      <div className="ml-auto hidden items-center gap-2 lg:flex">{cta}</div>
      <button type="button" className="ml-auto flex h-9 w-9 items-center justify-center border-2 border-ink lg:hidden" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      {open && (
        <div className="absolute inset-x-0 top-16 z-30 border-b-2 border-ink bg-surface p-4 lg:hidden">
          <nav className="flex flex-col gap-1" aria-label="Site">
            {items}
          </nav>
          <div className="mt-4 flex flex-wrap gap-2">{cta}</div>
        </div>
      )}
    </>
  );
}
