import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SiteNav } from "./site-nav";

export const SITE_LINKS = [
  { href: "/features", label: "Features" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/docs", label: "Manual" },
  { href: "/changelog", label: "Changelog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

/** Public website chrome. Always rendered in the Bauhaus Mix template: it is the brand statement. */
export function SiteShell({ children, signedIn }: { children: ReactNode; signedIn: boolean }) {
  return (
    <div data-template="bauhaus" className="site-shell relative min-h-screen bg-app text-body">
      <div className="site-backdrop" aria-hidden />
      <header className="relative z-20 border-b-2 border-ink bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label="OSES J home">
            <span data-ui="brand-mark" className="flex h-9 w-9 items-center justify-center bg-brand-500 text-white">
              <Image src="/brand/oses-j-mark.svg" alt="" width={22} height={22} className="h-[22px] w-[22px] brightness-0 invert" priority />
            </span>
            <Image src="/brand/oses-j-wordmark.svg" alt="OSES J" width={132} height={18} className="h-[18px] w-auto dark:brightness-0 dark:invert" priority />
          </Link>
          <SiteNav links={SITE_LINKS} signedIn={signedIn} />
        </div>
      </header>
      <main className="relative z-10">{children}</main>
      <footer className="relative z-10 mt-24 border-t-2 border-ink bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Image src="/brand/oses-j-wordmark.svg" alt="OSES J" width={140} height={19} className="h-[19px] w-auto dark:brightness-0 dark:invert" />
            <p className="mt-4 max-w-sm text-[13px] text-muted">AI-powered social export sales system for apparel, sportswear and fitness-wear manufacturers. Find buyers on Instagram and Facebook, organise them, and sell with an AI agent that never bypasses your rules.</p>
            <p className="mt-4 font-marker text-[15px] text-bauhaus-red">Made for exporters. Built by CNEX AI.</p>
          </div>
          <FooterColumn title="Product" links={[{ href: "/features", label: "Features" }, { href: "/how-it-works", label: "How it works" }, { href: "/changelog", label: "Changelog" }, { href: "/register", label: "Create account" }]} />
          <FooterColumn title="Manual" links={[{ href: "/docs/getting-started", label: "Getting started" }, { href: "/docs/finding-leads", label: "Finding leads" }, { href: "/docs/messaging-and-inbox", label: "Messaging" }, { href: "/docs/ai-assistant", label: "AI assistant" }, { href: "/docs/browser-extension", label: "Browser extension" }]} />
          <FooterColumn title="Company" links={[{ href: "/about", label: "About" }, { href: "/contact", label: "Contact" }, { href: "/privacy", label: "Privacy" }, { href: "/terms", label: "Terms" }]} />
        </div>
        <div className="border-t-2 border-ink">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-[12px] text-muted sm:px-6">
            <span>© {new Date().getFullYear()} CNEX AI. OSES J is a product of CNEX AI.</span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-bauhaus-red" />
              <span className="inline-block h-3 w-3 bg-bauhaus-blue" />
              <span className="inline-block h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-bauhaus-yellow" />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div>
      <h4 className="font-display text-[12px] uppercase tracking-[0.14em]">{title}</h4>
      <ul className="mt-3 space-y-2 text-[13px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted hover:text-body hover:underline">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
