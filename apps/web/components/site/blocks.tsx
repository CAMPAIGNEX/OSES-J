import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart3, Bookmark, Bot, Building2, FileText, Inbox, Megaphone, Plug, Search, ShieldCheck, TrendingUp, Users } from "@/components/ui/icons";
import type { Feature } from "@/content/features";
import { cn } from "@/lib/cn";

export const ACCENT_BG: Record<Feature["accent"], string> = {
  red: "bg-bauhaus-red text-white",
  blue: "bg-bauhaus-blue text-white",
  yellow: "bg-bauhaus-yellow text-ink",
  pink: "bg-pop-pink text-ink",
  green: "bg-pop-green text-ink",
};

export function FeatureIcon({ icon, className }: { icon: Feature["icon"]; className?: string }) {
  const c = className ?? "h-5 w-5";
  switch (icon) {
    case "search":
      return <Search className={c} />;
    case "bookmark":
      return <Bookmark className={c} />;
    case "users":
      return <Users className={c} />;
    case "inbox":
      return <Inbox className={c} />;
    case "bot":
      return <Bot className={c} />;
    case "megaphone":
      return <Megaphone className={c} />;
    case "file":
      return <FileText className={c} />;
    case "building":
      return <Building2 className={c} />;
    case "trending":
      return <TrendingUp className={c} />;
    case "chart":
      return <BarChart3 className={c} />;
    case "plug":
      return <Plug className={c} />;
    case "shield":
      return <ShieldCheck className={c} />;
  }
}

export function Section({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children, tone = "red" }: { children: ReactNode; tone?: "red" | "blue" | "yellow" }) {
  const bg = tone === "red" ? "bg-bauhaus-red text-white" : tone === "blue" ? "bg-bauhaus-blue text-white" : "bg-bauhaus-yellow text-ink";
  return <span className={cn("inline-block border-2 border-ink px-2.5 py-1 font-display text-[11px] uppercase tracking-[0.16em]", bg)}>{children}</span>;
}

export function Headline({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return <Tag className={cn("font-display uppercase leading-[0.95] tracking-tight", className)}>{children}</Tag>;
}

export function Marker({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("marker-note text-[18px]", className)}>{children}</span>;
}

export function PosterCard({ children, className, tape = true }: { children: ReactNode; className?: string; tape?: boolean }) {
  return (
    <div data-ui={tape ? "card" : undefined} className={cn("card p-6", className)}>
      {children}
    </div>
  );
}

export function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <Link href={`/features/${feature.slug}`} className="group block h-full">
      <PosterCard className="flex h-full flex-col transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-pop)]">
        <span className={cn("flex h-11 w-11 items-center justify-center border-2 border-ink", ACCENT_BG[feature.accent])}>
          <FeatureIcon icon={feature.icon} />
        </span>
        <h3 className="mt-5 font-display text-[17px] uppercase leading-tight">{feature.name}</h3>
        <p className="mt-1 font-marker text-[15px] text-bauhaus-red">{feature.tagline}</p>
        <p className="mt-3 text-[13px] leading-relaxed text-muted">{feature.description}</p>
        <span className="mt-auto pt-5 text-[12px] font-bold uppercase tracking-[0.12em] underline decoration-2 underline-offset-4">Read more</span>
      </PosterCard>
    </Link>
  );
}

export function Shapes({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative", className)} aria-hidden>
      <span className="absolute left-0 top-0 h-40 w-40 rounded-full border-2 border-ink bg-bauhaus-red shadow-[6px_6px_0_0_var(--ink)]" />
      <span className="absolute left-28 top-24 h-36 w-36 border-2 border-ink bg-bauhaus-blue shadow-[6px_6px_0_0_var(--ink)]" />
      <span className="absolute left-8 top-52 h-0 w-0 border-x-[70px] border-b-[120px] border-x-transparent border-b-bauhaus-yellow drop-shadow-[6px_6px_0_var(--ink)]" />
      <span className="absolute left-60 top-8 h-24 w-24 bg-[radial-gradient(circle,var(--ink)_1.6px,transparent_1.9px)] bg-[size:10px_10px]" />
      <span className="absolute left-56 top-56 font-marker text-[28px] text-pop-pink [transform:rotate(-8deg)]">sell more</span>
    </div>
  );
}

export function CtaBand({ signedIn }: { signedIn: boolean }) {
  return (
    <Section className="pb-0">
      <div className="relative overflow-hidden border-2 border-ink bg-ink px-6 py-12 text-paper shadow-[8px_8px_0_0_var(--color-bauhaus-red)] sm:px-12">
        <span className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-bauhaus-yellow" aria-hidden />
        <span className="absolute -bottom-8 right-48 h-0 w-0 border-x-[50px] border-b-[90px] border-x-transparent border-b-bauhaus-blue" aria-hidden />
        <div className="relative max-w-2xl">
          <Eyebrow tone="yellow">Start today</Eyebrow>
          <Headline className="mt-4 text-3xl sm:text-5xl">Your next buyer is posting right now.</Headline>
          <p className="mt-4 max-w-xl text-[15px] text-paper/80">Create a workspace, add your company facts, run your first search. No credit card. Your data stays in your workspace.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={signedIn ? "/dashboard" : "/register"} data-ui="button" data-variant="primary" className="inline-flex h-11 items-center px-6 text-[13px]">
              {signedIn ? "Open the app" : "Create your workspace"}
            </Link>
            <Link href="/docs/getting-started" className="inline-flex h-11 items-center border-2 border-paper px-6 font-display text-[12px] uppercase tracking-[0.08em] text-paper hover:bg-paper hover:text-ink">
              Read the manual
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
