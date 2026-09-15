/**
 * Structured logger.
 *
 * Small on purpose: no worker threads or transports, so it bundles cleanly inside Next.js
 * route handlers as well as the standalone worker. Output is one JSON object per line
 * (LOG_FORMAT=json) or a compact human-readable line (LOG_FORMAT=pretty).
 *
 * Sensitive keys are redacted recursively so tokens/passwords never reach logs.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

const SENSITIVE_KEY = /(password|passwd|secret|token|authorization|cookie|api[-_]?key|access[-_]?key|private[-_]?key|credential)/i;

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  child(bindings: LogFields): Logger;
}

interface LoggerConfig {
  level: LogLevel;
  format: "pretty" | "json";
  write: (line: string) => void;
}

const config: LoggerConfig = {
  level: (process.env.LOG_LEVEL as LogLevel) || "info",
  format: (process.env.LOG_FORMAT as "pretty" | "json") || "pretty",
  write: (line) => {
    process.stdout.write(line + "\n");
  },
};

export function configureLogger(partial: Partial<LoggerConfig>): void {
  Object.assign(config, partial);
}

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface RecentLogEntry {
  time: string;
  level: "warn" | "error";
  logger: string;
  msg: string;
  fields: Record<string, unknown>;
}

const RECENT_LIMIT = 100;
const recent: RecentLogEntry[] = [];

/**
 * Last warnings and errors of this process (newest first), for the OS-Panel. Hosts without log access
 * still let operators see what went wrong; values pass through the same redaction as the log lines.
 */
export function getRecentLogs(limit = RECENT_LIMIT): RecentLogEntry[] {
  return recent.slice(-limit).reverse();
}

function emit(level: LogLevel, name: string, bindings: LogFields, msg: string, fields?: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[config.level]) return;
  const record: Record<string, unknown> = {
    time: new Date().toISOString(),
    level,
    logger: name,
    msg,
    ...(redact(bindings) as Record<string, unknown>),
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  };
  if (level === "warn" || level === "error") {
    const { time, level: lvl, logger, msg: message, ...rest } = record;
    recent.push({ time: String(time), level: lvl as "warn" | "error", logger: String(logger), msg: String(message), fields: rest });
    if (recent.length > RECENT_LIMIT) recent.splice(0, recent.length - RECENT_LIMIT);
  }
  if (config.format === "json") {
    config.write(JSON.stringify(record));
    return;
  }
  const { time, level: lvl, logger, msg: message, ...rest } = record;
  const extra = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
  config.write(`${String(time).slice(11, 23)} ${String(lvl).toUpperCase().padEnd(5)} [${String(logger)}] ${String(message)}${extra}`);
}

export function createLogger(name: string, bindings: LogFields = {}): Logger {
  return {
    debug: (msg, fields) => emit("debug", name, bindings, msg, fields),
    info: (msg, fields) => emit("info", name, bindings, msg, fields),
    warn: (msg, fields) => emit("warn", name, bindings, msg, fields),
    error: (msg, fields) => emit("error", name, bindings, msg, fields),
    child: (more) => createLogger(name, { ...bindings, ...more }),
  };
}

export const rootLogger = createLogger("oses");
