"use client";

import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import type { ReactNode } from "react";
import { Button, cn, Skeleton } from "./primitives";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  width?: string;
  align?: "left" | "right" | "center";
}

export function DataTable<T>({ columns, rows, rowKey, loading, empty, onRowClick, selectable, selected, onToggle, onToggleAll, dense, stickyHeader = true }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; loading?: boolean; empty?: ReactNode; onRowClick?: (row: T) => void; selectable?: boolean; selected?: Set<string>; onToggle?: (id: string) => void; onToggleAll?: (ids: string[]) => void; dense?: boolean; stickyHeader?: boolean }) {
  const allIds = rows.map(rowKey);
  const allSelected = selectable && allIds.length > 0 && allIds.every((id) => selected?.has(id));
  const pad = dense ? "px-3 py-2" : "px-3 py-2.5";
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {selectable && (
              <th className={cn("w-9 border-b border-default bg-surface-2 px-3 py-2 text-left", stickyHeader && "sticky top-0 z-10")}>
                <input type="checkbox" aria-label="Select all" className="h-3.5 w-3.5 accent-brand-500" checked={Boolean(allSelected)} onChange={() => onToggleAll?.(allIds)} />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined} className={cn("border-b border-default bg-surface-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted", c.align === "right" && "text-right", c.align === "center" && "text-center", stickyHeader && "sticky top-0 z-10", c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={`sk-${i}`}>
                  {selectable && (
                    <td className={cn("border-b border-default", pad)}>
                      <Skeleton className="h-3.5 w-3.5" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("border-b border-default", pad)}>
                      <Skeleton className="h-3.5" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const id = rowKey(row);
                const isSelected = selected?.has(id);
                return (
                  <tr key={id} onClick={onRowClick ? () => onRowClick(row) : undefined} className={cn("group transition-colors", onRowClick && "cursor-pointer", isSelected ? "bg-brand-50/60 dark:bg-brand-900/20" : "hover:bg-surface-2/70")}>
                    {selectable && (
                      <td className={cn("border-b border-default", pad)} onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" aria-label="Select row" className="h-3.5 w-3.5 accent-brand-500" checked={Boolean(isSelected)} onChange={() => onToggle?.(id)} />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={cn("border-b border-default align-middle text-body", pad, c.align === "right" && "text-right", c.align === "center" && "text-center", c.className)}>
                        {c.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
      {!loading && rows.length === 0 && <div className="px-4 py-8">{empty ?? <p className="text-center text-sm text-muted">No results</p>}</div>}
    </div>
  );
}

export function Pagination({ page, totalPages, total, pageSize, onPage, className }: { page: number; totalPages: number; total: number; pageSize: number; onPage: (p: number) => void; className?: string }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-1 text-[13px] text-muted", className)}>
      <span className="tabular">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="xs" onClick={() => onPage(page - 1)} disabled={page <= 1} icon={<ChevronLeft className="h-3.5 w-3.5" />}>
          Prev
        </Button>
        <span className="px-2 tabular">
          {page} / {totalPages}
        </span>
        <Button variant="outline" size="xs" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, icon, href, tone = "neutral", loading }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; href?: string; tone?: "neutral" | "brand" | "success" | "warning" | "danger"; loading?: boolean }) {
  const toneClass = { neutral: "text-muted", brand: "text-brand-600", success: "text-emerald-600", warning: "text-amber-600", danger: "text-red-600" }[tone];
  const inner = (
    <div data-ui="stat" className={cn("card flex h-full flex-col justify-between p-4 transition-shadow", href && "hover:shadow-[var(--shadow-pop)]")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium uppercase tracking-wide text-muted">{label}</span>
        {icon && <span className={cn("shrink-0", toneClass)}>{icon}</span>}
      </div>
      <div className="mt-2">
        {loading ? <Skeleton className="h-7 w-20" /> : <span data-ui="stat-value" className="text-2xl font-semibold tabular text-body">{value}</span>}
        {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="block h-full">
        {inner}
      </a>
    );
  }
  return inner;
}

export function KeyValue({ items, className, columns = 1 }: { items: Array<{ label: ReactNode; value: ReactNode; hidden?: boolean }>; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-3", columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1", className)}>
      {items
        .filter((i) => !i.hidden)
        .map((i, idx) => (
          <div key={idx} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-faint">{i.label}</dt>
            <dd className="mt-0.5 break-words text-[13px] text-body">{i.value ?? <span className="text-faint">—</span>}</dd>
          </div>
        ))}
    </dl>
  );
}
