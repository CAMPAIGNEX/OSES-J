"use client";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  /** Field-level messages from validation errors keyed by path. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) for (const d of this.details as Array<{ path?: string; message?: string }>) if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
    return out;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON encoding (FormData uploads) */
  raw?: boolean;
}

/** Browser-side fetch helper: JSON in/out, cookies included, typed errors. */
export async function api<T = unknown>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, raw, headers, ...rest } = options;
  const init: RequestInit = { credentials: "same-origin", ...rest, headers: { Accept: "application/json", ...(raw ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}), ...(headers as Record<string, string>) } };
  if (body !== undefined) init.body = raw ? (body as BodyInit) : JSON.stringify(body);
  if (!init.method && body !== undefined) init.method = "POST";
  const res = await fetch(path, init);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } = {};
    if (type.includes("application/json")) payload = (await res.json().catch(() => ({}))) as typeof payload;
    if (res.status === 401 && typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    }
    throw new ApiError(res.status, payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? `Request failed (${res.status})`, payload.error?.details);
  }
  if (res.status === 204) return undefined as T;
  if (type.includes("application/json")) return (await res.json()) as T;
  return (await res.blob()) as unknown as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}
