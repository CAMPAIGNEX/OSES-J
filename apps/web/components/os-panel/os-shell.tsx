"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, Building2, FileText, KeyRound, LayoutDashboard, Server, ShieldCheck, Terminal, Users } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/os-panel", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" />, exact: true },
  { href: "/os-panel/organizations", label: "Organizations", icon: <Building2 className="h-4 w-4" /> },
  { href: "/os-panel/users", label: "Users", icon: <Users className="h-4 w-4" /> },
  { href: "/os-panel/platform", label: "Providers & keys", icon: <KeyRound className="h-4 w-4" /> },
  { href: "/os-panel/jobs", label: "Jobs", icon: <Terminal className="h-4 w-4" /> },
  { href: "/os-panel/audit", label: "Audit log", icon: <FileText className="h-4 w-4" /> },
  { href: "/os-panel/system", label: "System", icon: <Server className="h-4 w-4" /> },
];

/**
 * OS-Panel chrome: the CNEX AI control room. Deliberately different from the customer app
 * (ink background, mono accents) so operators always know which side they are on.
 */
export function OsShell({ operator, children }: { operator: { name: string; email: string }; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div data-template="classic" className="dark min-h-screen bg-[#0a0d14] text-[#e6edf7]">
      <header className="sticky top-0 z-30 border-b border-[#1f2937] bg-[#0f131c]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
          <Link href="/os-panel" className="flex items-center gap-2.5" aria-label="OS-Panel home">
            <span className="flex h-8 w-8 items-center justify-center bg-bauhaus-red text-white">
              <Image src="/brand/oses-j-mark.svg" alt="" width={18} height={18} className="h-[18px] w-[18px] brightness-0 invert" />
            </span>
            <span className="font-mono text-[13px] font-bold tracking-[0.2em]">OS-PANEL</span>
            <span className="hidden rounded-sm border border-[#374151] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#9ca3af] sm:inline">cnex ai · operators only</span>
          </Link>
          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="OS-Panel">
            {NAV.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} className={cn("flex items-center gap-2 px-3 py-1.5 font-mono text-[12px] uppercase tracking-wider transition-colors", active ? "bg-bauhaus-yellow text-[#111]" : "text-[#9ca3af] hover:bg-[#1f2937] hover:text-white")} aria-current={active ? "page" : undefined}>
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-1.5 font-mono text-[11px] text-[#9ca3af] md:flex">
              <ShieldCheck className="h-3.5 w-3.5 text-pop-green" />
              {operator.email}
            </span>
            <Link href="/dashboard" className="border border-[#374151] px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-[#e6edf7] hover:bg-[#1f2937]">
              ← App
            </Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-[#1f2937] px-2 py-1 lg:hidden" aria-label="OS-Panel">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} className={cn("whitespace-nowrap px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider", active ? "bg-bauhaus-yellow text-[#111]" : "text-[#9ca3af]")}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 py-8 font-mono text-[11px] text-[#6b7280] sm:px-6">
        <BarChart3 className="mr-1.5 inline h-3 w-3" />
        Every action here is written to the audit log with your email.
      </footer>
    </div>
  );
}

export function OsPageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-mono text-lg font-bold uppercase tracking-[0.12em]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-[#9ca3af]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function OsPanel({ title, children, className, actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn("border border-[#1f2937] bg-[#0f131c]", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#1f2937] px-4 py-2.5">
          {title && <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#9ca3af]">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function OsStat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "red" | "yellow" | "green" | "blue" }) {
  const color = tone === "red" ? "text-bauhaus-red" : tone === "yellow" ? "text-bauhaus-yellow" : tone === "green" ? "text-pop-green" : tone === "blue" ? "text-[#60a5fa]" : "text-white";
  return (
    <div className="border border-[#1f2937] bg-[#0f131c] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#6b7280]">{label}</p>
      <p className={cn("mt-2 font-mono text-2xl font-bold tabular-nums", color)}>{value}</p>
      {hint && <p className="mt-1 text-[12px] text-[#9ca3af]">{hint}</p>}
    </div>
  );
}

export function OsTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-[13px] [&_td]:border-t [&_td]:border-[#1f2937] [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:px-3 [&_th]:pb-2 [&_th]:text-left [&_th]:font-mono [&_th]:text-[10px] [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-[#6b7280]">{children}</table>
    </div>
  );
}

export function OsButton({ children, onClick, tone = "neutral", disabled, href, type = "button" }: { children: ReactNode; onClick?: () => void; tone?: "neutral" | "danger" | "primary"; disabled?: boolean; href?: string; type?: "button" | "submit" }) {
  const classes = cn("inline-flex h-8 items-center gap-1.5 border px-3 font-mono text-[11px] uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-50", tone === "danger" ? "border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white" : tone === "primary" ? "border-bauhaus-yellow bg-bauhaus-yellow text-[#111] hover:bg-[#ffd75e]" : "border-[#374151] text-[#e6edf7] hover:bg-[#1f2937]");
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}

export function OsInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("h-8 border border-[#374151] bg-[#0a0d14] px-2.5 font-mono text-[12px] text-[#e6edf7] placeholder:text-[#4b5563] focus:border-bauhaus-yellow focus:outline-none", props.className)} />;
}

export function OsSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("h-8 border border-[#374151] bg-[#0a0d14] px-2 font-mono text-[12px] text-[#e6edf7] focus:border-bauhaus-yellow focus:outline-none", props.className)} />;
}

export function OsBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "red" | "yellow" | "blue" }) {
  const c = tone === "green" ? "border-pop-green text-pop-green" : tone === "red" ? "border-bauhaus-red text-bauhaus-red" : tone === "yellow" ? "border-bauhaus-yellow text-bauhaus-yellow" : tone === "blue" ? "border-[#60a5fa] text-[#60a5fa]" : "border-[#374151] text-[#9ca3af]";
  return <span className={cn("inline-block border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider", c)}>{children}</span>;
}
