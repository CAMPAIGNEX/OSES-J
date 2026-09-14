/**
 * Application error model.
 *
 * Every error that crosses a service boundary is an AppError with a stable `code`
 * (safe to show to API consumers) and an HTTP status. Provider failures additionally
 * carry an ErrorClass used by the job system to decide whether to retry.
 */

export type ErrorClass =
  | "TEMPORARY"
  | "PERMANENT"
  | "AUTHENTICATION"
  | "RATE_LIMIT"
  | "TARGET_UNAVAILABLE"
  | "USER_ACTION_REQUIRED";

export interface AppErrorOptions {
  status?: number;
  details?: unknown;
  cause?: unknown;
  errorClass?: ErrorClass;
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  readonly errorClass: ErrorClass;
  readonly retryable: boolean;
  override readonly cause: unknown;

  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? 500;
    this.details = options.details;
    this.cause = options.cause;
    this.errorClass = options.errorClass ?? (this.status >= 500 ? "TEMPORARY" : "PERMANENT");
    this.retryable = options.retryable ?? (this.errorClass === "TEMPORARY" || this.errorClass === "RATE_LIMIT");
  }

  toJSON(): { code: string; message: string; details?: unknown } {
    return { code: this.code, message: this.message, ...(this.details !== undefined ? { details: this.details } : {}) };
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: unknown) {
    super("VALIDATION_ERROR", message, { status: 400, details, errorClass: "PERMANENT" });
    this.name = "ValidationError";
  }
}

export class AuthError extends AppError {
  constructor(message = "Authentication required") {
    super("UNAUTHENTICATED", message, { status: 401, errorClass: "AUTHENTICATION" });
    this.name = "AuthError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource") {
    super("FORBIDDEN", message, { status: 403, errorClass: "PERMANENT" });
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity = "Resource", details?: unknown) {
    super("NOT_FOUND", `${entity} not found`, { status: 404, details, errorClass: "PERMANENT" });
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super("CONFLICT", message, { status: 409, details, errorClass: "PERMANENT" });
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details?: unknown) {
    super("RATE_LIMITED", message, { status: 429, details, errorClass: "RATE_LIMIT" });
    this.name = "RateLimitError";
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, details?: unknown) {
    super("NOT_CONFIGURED", message, { status: 503, details, errorClass: "USER_ACTION_REQUIRED", retryable: false });
    this.name = "ConfigurationError";
  }
}

/** Failure reported by an external provider (Apify, Meta, AI vendor, browser extension). */
export class ProviderError extends AppError {
  readonly provider: string;
  constructor(provider: string, message: string, options: AppErrorOptions & { code?: string } = {}) {
    const { code, ...rest } = options;
    super(code ?? "PROVIDER_ERROR", message, { status: 502, ...rest });
    this.name = "ProviderError";
    this.provider = provider;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function toAppError(err: unknown, fallbackCode = "INTERNAL_ERROR"): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error) return new AppError(fallbackCode, err.message, { cause: err });
  return new AppError(fallbackCode, typeof err === "string" ? err : "Unexpected error", { cause: err });
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Classify an unknown error for retry decisions in the job system. */
export function classifyError(err: unknown): ErrorClass {
  if (err instanceof AppError) return err.errorClass;
  const msg = errorMessage(err).toLowerCase();
  if (/(econnreset|etimedout|econnrefused|socket hang up|fetch failed|timeout|503|502|504)/.test(msg)) return "TEMPORARY";
  if (/(rate limit|too many requests|429)/.test(msg)) return "RATE_LIMIT";
  if (/(unauthori[sz]ed|forbidden|401|403|invalid token|expired)/.test(msg)) return "AUTHENTICATION";
  return "PERMANENT";
}
