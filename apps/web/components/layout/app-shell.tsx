"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BarChart3, Bot, Building2, FileText, Inbox, LayoutDashboard, LogOut, Megaphone, Menu as MenuIcon, Moon, Search, Settings, Sun, Trash2, TrendingUp, Users, Bookmark, Zap, ChevronsUpDown } from "lucide-react";
import { api } from "@/lib/api-client";
import { Avatar, cn } from "@/components/ui/primitives";
import { Menu } from "@/components/ui/overlay";

export interface ShellSession {
  user: { id: string; email: string; name: string };
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
  { href: "/leads/saved", label: "Saved Leads", icon: <Bookmark className="h-4 w-4" />, match: (p) => p.startsWith("/leads/saved") || /^\/leads\/[^/]+$/.test(p) },
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
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("oses-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
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
  async function switchOrg(id: string) {
    await api("/api/auth/switch-org", { body: { organizationId: id } });
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
      {NAV.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className={cn("flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors", active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100" : "text-muted hover:bg-surface-2 hover:text-body")} aria-current={active ? "page" : undefined}>
            <span className={cn(active ? "text-brand-600 dark:text-brand-200" : "text-faint")}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebar = (
    <aside className="flex h-full w-[248px] flex-col border-r border-default bg-surface">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-white">
          <Zap className="h-4 w-4" />
        </span>
        <span className="text-[15px] font-semibold tracking-tight">OSES J</span>
      </div>
      <div className="px-3 pb-3">
        <Menu
          align="left"
          trigger={
            <button type="button" className="flex w-full items-center gap-2 rounded-lg border border-default bg-surface-2 px-2.5 py-2 text-left hover:border-strong">
              <Avatar name={session.organization.name} size={26} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{session.organization.name}</span>
                <span className="block text-[11px] text-faint capitalize">{session.organization.role.toLowerCase()}</span>
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 text-faint" />
            </button>
          }
          items={[...session.memberships.map((m) => ({ label: `${m.id === session.organization.id ? "✓ " : ""}${m.name}`, onSelect: () => void switchOrg(m.id), disabled: m.id === session.organization.id })), "separator", { label: "Company settings", onSelect: () => router.push("/settings/company") }]}
        />
      </div>
      {nav}
      <div className="mt-auto border-t border-default p-3">
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
      <div className="flex min-h-screen">
        <div className="hidden lg:block lg:fixed lg:inset-y-0 lg:left-0">{sidebar}</div>
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 animate-in">{sidebar}</div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-default bg-surface/90 px-4 backdrop-blur lg:hidden">
            <button type="button" onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-surface-2" aria-label="Open navigation">
              <MenuIcon className="h-5 w-5" />
            </button>
            <span className="font-semibold">OSES J</span>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </SessionContext.Provider>
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
