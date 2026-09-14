/** Small formatting helpers shared by pages (client-safe). */

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, { dateStyle: "medium", timeStyle: "short" });
}

export function timeAgo(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const units: Array<[number, string]> = [
    [60_000, "s"],
    [3_600_000, "m"],
    [86_400_000, "h"],
    [604_800_000, "d"],
    [2_592_000_000, "w"],
    [31_536_000_000, "mo"],
  ];
  let value2 = Math.round(abs / 1000);
  let unit = "s";
  for (let i = 0; i < units.length; i++) {
    const [ms, label] = units[i]!;
    if (abs < ms) {
      const prev = i === 0 ? 1000 : units[i - 1]![0];
      value2 = Math.max(1, Math.round(abs / prev));
      unit = i === 0 ? "s" : units[i - 1]![1];
      break;
    }
    if (i === units.length - 1) {
      value2 = Math.round(abs / 31_536_000_000);
      unit = "y";
    }
  }
  if (abs < 45_000) return future ? "in a moment" : "just now";
  return future ? `in ${value2}${unit}` : `${value2}${unit} ago`;
}

export function percent(numerator: number, denominator: number): string {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/_/g, " ").toLowerCase().replace(/(^|\s)\w/g, (c) => c.toUpperCase());
}

export function platformName(p: string | null | undefined): string {
  return p === "INSTAGRAM" ? "Instagram" : p === "FACEBOOK" ? "Facebook" : p ?? "—";
}
