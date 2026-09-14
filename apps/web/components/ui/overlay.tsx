"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "@/components/ui/icons";
import { Button, cn } from "./primitives";

// ---------- Toasts ----------

type ToastTone = "success" | "error" | "info" | "warning";
interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  push: (t: Omit<Toast, "id">) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneIcon: Record<ToastTone, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
  info: <Info className="h-4 w-4 text-brand-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), t.tone === "error" ? 8000 : 4500);
  }, []);
  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: "success" }),
      error: (title, description) => push({ title, description, tone: "error" }),
      info: (title, description) => push({ title, description, tone: "info" }),
      warning: (title, description) => push({ title, description, tone: "warning" }),
    }),
    [push],
  );
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto animate-in card flex items-start gap-3 p-3 shadow-[var(--shadow-pop)]">
            <span className="mt-0.5 shrink-0">{toneIcon[t.tone]}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-body">{t.title}</p>
              {t.description && <p className="mt-0.5 text-xs text-muted break-words">{t.description}</p>}
            </div>
            <button type="button" className="text-faint hover:text-body" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

// ---------- Dialog (native <dialog>) ----------

export function Dialog({ open, onClose, title, description, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  const widths = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn("m-auto w-[calc(100vw-2rem)] rounded-2xl border border-default bg-surface p-0 text-body shadow-[var(--shadow-pop)] backdrop:bg-transparent open:animate-in", widths[size])}
    >
      <div className="flex items-start justify-between gap-4 border-b border-default px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-md p-1 text-faint hover:bg-surface-2 hover:text-body" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      {children && <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>}
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-default px-5 py-3">{footer}</div>}
    </dialog>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Confirm", tone = "primary", loading, children }: { open: boolean; onClose: () => void; onConfirm: () => void | Promise<void>; title: ReactNode; description?: ReactNode; confirmLabel?: string; tone?: "primary" | "danger"; loading?: boolean; children?: ReactNode }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant={tone} onClick={() => void onConfirm()} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

// ---------- Simple dropdown menu ----------

export function Menu({ trigger, items, align = "right" }: { trigger: ReactNode; items: Array<{ label: ReactNode; onSelect: () => void; danger?: boolean; disabled?: boolean } | "separator">; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative inline-block">
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div className={cn("animate-in absolute z-50 mt-1 min-w-[180px] rounded-lg border border-default bg-surface p-1 shadow-[var(--shadow-pop)]", align === "right" ? "right-0" : "left-0")} role="menu">
          {items.map((item, i) =>
            item === "separator" ? (
              <div key={i} className="my-1 h-px bg-[var(--border)]" />
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cn("flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-surface-2 disabled:opacity-50", item.danger ? "text-red-600" : "text-body")}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Tabs ----------

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: Array<{ value: T; label: ReactNode; count?: number }>; className?: string }) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto border-b border-default", className)} role="tablist">
      {items.map((it) => (
        <button key={it.value} type="button" role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)} className={cn("-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors", value === it.value ? "border-brand-500 text-brand-600" : "border-transparent text-muted hover:text-body")}>
          {it.label}
          {it.count !== undefined && <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] tabular", value === it.value ? "bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200" : "bg-surface-2 text-faint")}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}
