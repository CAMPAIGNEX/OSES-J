"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { BarChart3, Bot, Building2, FileText, Inbox, LayoutDashboard, LogOut, Megaphone, Menu as MenuIcon, Moon, Search, Settings, Sun, Trash2, TrendingUp, Users, Bookmark, ShieldCheck } from "@/components/ui/icons";
import { api } from "@/lib/api-client";
import { applyTheme } from "@/lib/theme";
import { Avatar, cn } from "@/components/ui/primitives";

export interface ShellSession {
  user: { id: string; email: string; name: string; isSuperAdmin?: boolean };
  organization: { id: string; name: string; slug: string; role: string };
  memberships: Array<{ id: string; name: string; slug: string; role: string }>;
}

const SessionContext = createContext<ShellSession | null>(null);
export function useSession(): ShellSession {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession outside AppShell");
  return ctx;
}

const NAV: Array<{ href: string; label: string; icon: ReactNode; match?: (p: string) => boolean }> = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: "/leads/search", label: "Search Leads", icon: <Search className="h-4 w-4" />, match: (p) => p.startsWith("/leads/search") },
  { href: "/leads/saved", label: "Saved Leads", icon: <Bookmark className="h-4 w-4" />, match: (p) => p.startsWith("/leads/saved") || /^\/leads\/(?!search|saved)[^/]+$/.test(p) },
  { href: "/clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
  { href: "/inbox", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
  { href: "/ai-assistant", label: "AI Assistant", icon: <Bot className="h-4 w-4" /> },
  { href: "/campaigns", label: "Campaigns", icon: <Megaphone className="h-4 w-4" /> },
  { href: "/documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { href: "/competitors", label: "Competitor Analysis", icon: <Building2 className="h-4 w-4" /> },
  { href: "/trends", label: "Trend Analysis", icon: <TrendingUp className="h-4 w-4" /> },
  { href: "/performance", label: "Performance", icon: <BarChart3 className="h-4 w-4" /> },
  { href: "/trash", label: "Trash", icon: <Trash2 className="h-4 w-4" /> },
  { href: "/settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    applyTheme(next ? "dark" : "light");
  };
  return { dark, toggle };
}

export function AppShell({ session, children }: { session: ShellSession; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { dark, toggle } = useTheme();
  useEffect(() => setMobileOpen(false), [pathname]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
      {NAV.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} data-ui="nav-link" className={cn("flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-medium transition-colors lg:min-h-0 lg:gap-2.5 lg:px-2.5 lg:text-[13px]", active ? "nav-active" : "text-muted hover:bg-surface-2 hover:text-body")} aria-current={active ? "page" : undefined}>
            <span className={cn(active ? "text-current" : "text-faint")}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <aside data-ui="sidebar" className="flex h-full w-[248px] flex-col border-r border-default bg-surface">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <Link href="/dashboard" className="flex items-center" aria-label="OSES-J home">
          <Image src="/brand/oses-j-wordmark.svg" alt="OSES-J" width={132} height={18} className="h-[18px] w-auto dark:brightness-0 dark:invert" priority />
        </Link>
      </div>
      {nav}
      {session.user.isSuperAdmin && (
        <div className="px-3 pt-2">
          <Link href="/os-panel" data-ui="nav-link" className="flex items-center gap-2.5 rounded-lg border border-dashed border-strong px-2.5 py-2 text-[12px] font-semibold text-muted hover:bg-surface-2 hover:text-body">
            <ShieldCheck className="h-4 w-4 text-faint" />
            OS-Panel
          </Link>
        </div>
      )}
      <div data-ui="sidebar-footer" className="mt-auto border-t border-default p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <Avatar name={session.user.name} size={28} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium">{session.user.name}</p>
            <p className="truncate text-[11px] text-faint">{session.user.email}</p>
          </div>
          <button type="button" onClick={toggle} className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-body" aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => void logout()} className="rounded-md p-1.5 text-faint hover:bg-surface-2 hover:text-red-600" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <SessionContext.Provider value={session}>
      <div className="relative flex min-h-[100dvh]">
        <div className="app-backdrop" aria-hidden />
        <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0 lg:z-10">{sidebar}</div>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 max-w-[85vw] animate-in pb-[env(safe-area-inset-bottom)]">{sidebar}</div>
          </div>
        )}
        <div className="relative z-[1] flex min-w-0 flex-1 flex-col lg:pl-[248px]">
          <header data-ui="topbar" className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-default bg-surface/90 px-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
            <button type="button" onClick={() => setMobileOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-muted active:bg-surface-2" aria-label="Open menu">
              <MenuIcon className="h-6 w-6" />
            </button>
            <Link href="/dashboard" className="flex items-center" aria-label="Dashboard">
              <Image src="/brand/oses-j-wordmark.svg" alt="OSES-J" width={104} height={14} className="h-3.5 w-auto dark:brightness-0 dark:invert" />
            </Link>
            <span className="ml-auto truncate text-[12px] text-faint">{session.organization.name}</span>
          </header>
          <main className="flex-1 px-4 pb-[calc(84px+env(safe-area-inset-bottom))] pt-4 sm:px-6 lg:px-8 lg:py-6">{children}</main>
        </div>
        <MobileTabBar pathname={pathname} onMore={() => setMobileOpen(true)} />
      </div>
    </SessionContext.Provider>
  );
}

const TABS: Array<{ href: string; label: string; icon: ReactNode; match: (p: string) => boolean }> = [
  { href: "/dashboard", label: "Home", icon: <LayoutDashboard className="h-5 w-5" />, match: (p) => p.startsWith("/dashboard") },
  { href: "/leads/search", label: "Leads", icon: <Search className="h-5 w-5" />, match: (p) => p.startsWith("/leads") },
  { href: "/clients", label: "Clients", icon: <Users className="h-5 w-5" />, match: (p) => p.startsWith("/clients") },
  { href: "/inbox", label: "Inbox", icon: <Inbox className="h-5 w-5" />, match: (p) => p.startsWith("/inbox") },
];

/** Phone navigation: an app-style bottom tab bar (the drawer holds everything else). */
function MobileTabBar({ pathname, onMore }: { pathname: string; onMore: () => void }) {
  return (
    <nav data-ui="tabbar" className="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Primary">
      <ul className="grid grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <li key={t.href}>
              <Link href={t.href} data-ui="tab" aria-current={active ? "page" : undefined} className={cn("flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium", active ? "text-brand-600 dark:text-brand-200" : "text-faint active:text-body")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-brand-50 dark:bg-brand-900/40")}>{t.icon}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button type="button" onClick={onMore} data-ui="tab" className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-faint active:text-body" aria-label="More">
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <MenuIcon className="h-5 w-5" />
            </span>
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function PageHeader({ title, description, actions, breadcrumb }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumb?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-faint">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
