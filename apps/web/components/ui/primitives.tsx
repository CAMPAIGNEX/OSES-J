"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2 } from "@/components/ui/icons";

import { cn } from "@/lib/cn";
export { cn };

// ---------- Button ----------

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
type ButtonSize = "xs" | "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700 shadow-sm disabled:bg-brand-300",
  secondary: "bg-surface-2 text-body hover:bg-[color-mix(in_oklab,var(--surface-2)_70%,var(--border))] border border-default",
  outline: "bg-surface text-body border border-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-body",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  link: "text-brand-600 hover:underline px-0 h-auto",
};

const buttonSizes: Record<ButtonSize, string> = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-md",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 text-sm gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-lg",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, icon, href, className, children, disabled, type, ...props }, ref) {
  const classes = cn("inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors select-none disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-2", buttonVariants[variant], buttonSizes[size], className);
  if (href && !disabled) {
    return (
      <Link href={href} className={classes} data-ui="button" data-variant={variant}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type ?? "button"} className={classes} disabled={disabled || loading} data-ui="button" data-variant={variant} {...props}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

// ---------- Inputs ----------

const fieldBase = "rounded-lg border border-strong bg-surface px-3 text-sm text-body placeholder:text-faint transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60";

/** Fields fill their container unless the caller sizes them (w-*, flex-*, basis-*). */
function fieldWidth(className?: string): string {
  return className && /(^|s)(w-|min-w-|max-w-|flex-|basis-|grow)/.test(className) ? "" : "w-full";
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(function Input({ className, invalid, ...props }, ref) {
  return <input ref={ref} data-ui="input" className={cn(fieldBase, fieldWidth(className), "h-9", invalid && "border-red-500 focus:border-red-500 focus:ring-red-500/20", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} data-ui="input" className={cn(fieldBase, fieldWidth(className), "py-2 min-h-[96px] leading-relaxed", invalid && "border-red-500", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select ref={ref} data-ui="input" className={cn(fieldBase, fieldWidth(className), "h-9 pr-8 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:12px] bg-[right_10px_center] bg-no-repeat", invalid && "border-red-500", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ children, htmlFor, className, hint }: { children: ReactNode; htmlFor?: string; className?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} data-ui="label" className={cn("mb-1.5 block text-[13px] font-medium text-body", className)}>
      {children}
      {hint && <span className="ml-1.5 font-normal text-faint">{hint}</span>}
    </label>
  );
}

export function Field({ label, hint, error, children, className, description }: { label: ReactNode; hint?: string; error?: string | null; children: ReactNode; className?: string; description?: ReactNode }) {
  return (
    <div className={cn("min-w-0", className)}>
      <Label hint={hint}>{label}</Label>
      {children}
      {description && !error && <p className="mt-1 text-xs text-faint">{description}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled, description }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; description?: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3", disabled ? "opacity-60" : "cursor-pointer")}>
      <button type="button" role="switch" data-ui="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cn("relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", checked ? "bg-brand-500" : "bg-[var(--border-strong)]")}>
        <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-body">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}

// ---------- Card ----------

export function Card({ children, className, padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div data-ui="card" className={cn("card", padded && "p-5", className)}>{children}</div>;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 data-ui="card-title" className="text-[15px] font-semibold text-body">{title}</h3>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Badge ----------

type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "purple";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted border-default",
  brand: "bg-brand-50 text-brand-700 border-brand-100 dark:bg-brand-900/40 dark:text-brand-200 dark:border-brand-800",
  success: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  warning: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  danger: "bg-red-50 text-red-700 border-red-100 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800",
  info: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  purple: "bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800",
};

export function Badge({ children, tone = "neutral", className, dot }: { children: ReactNode; tone?: Tone; className?: string; dot?: boolean }) {
  return (
    <span data-ui="badge" data-tone={tone} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const STATUS_TONES: Record<string, Tone> = {
  NEW: "info",
  CONTACTED: "brand",
  REPLIED: "purple",
  INTERESTED: "success",
  NEGOTIATING: "warning",
  CUSTOMER: "success",
  NOT_INTERESTED: "neutral",
  DO_NOT_CONTACT: "danger",
  ARCHIVED: "neutral",
  QUEUED: "info",
  RUNNING: "brand",
  ENRICHING: "brand",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  SENT: "success",
  DELIVERED: "success",
  SEEN: "success",
  SENDING: "brand",
  DRAFT: "neutral",
  PENDING_APPROVAL: "warning",
  UNAVAILABLE: "warning",
  SCHEDULED: "info",
  CLAIMED: "brand",
  RETRYING: "warning",
  BLOCKED: "danger",
  REQUIRES_USER: "warning",
  ONLINE: "success",
  OFFLINE: "neutral",
  CONNECTED: "success",
  EXPIRED: "warning",
  DISCONNECTED: "neutral",
  ERROR: "danger",
  PAUSED: "warning",
  READY: "success",
  PROCESSING: "brand",
  PENDING: "info",
  MESSAGEABLE: "success",
  NOT_MESSAGEABLE: "danger",
  DISCOVERED: "neutral",
  PROVIDER_ERROR: "danger",
  SAVED: "brand",
  ADDED: "success",
  VERIFIED: "success",
  PUBLIC: "info",
  INFERRED: "warning",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge>Unknown</Badge>;
  return <Badge tone={STATUS_TONES[status] ?? "neutral"}>{status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</Badge>;
}

// ---------- Misc ----------

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-4 w-4 animate-spin text-muted", className)} aria-label="Loading" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 w-full", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div data-ui="empty" className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-strong px-6 py-12 text-center", className)}>
      {icon && <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted">{icon}</div>}
      <h3 className="text-sm font-semibold text-body">{title}</h3>
      {description && <p className="mt-1 max-w-md text-[13px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", className)} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38), background: `hsl(${hue} 55% 48%)` }} aria-hidden>
      {initials || "?"}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted">{children}</kbd>;
}
