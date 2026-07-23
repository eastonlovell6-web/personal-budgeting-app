// Money and date formatting helpers.

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** $1,234.56 */
export function money(n: number): string {
  return usd.format(n);
}

/** $1,235 (no cents) — for axes and big headline numbers. */
export function money0(n: number): string {
  return usd0.format(n);
}

/** $1.2K / $15.9K / $1.2M — compact, for tight axis ticks. */
export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

/** "2026-01" -> "Jan" (short month label for axes). */
export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Human date-range label, e.g. "Jan 1 – Jun 30, 2026". */
export function rangeLabel(start: Date, end: Date): string {
  const s = start.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const e = end.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  return `${s} – ${e}`;
}

/** YYYY-MM-DD in UTC (for API query params). */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Distinct calendar months (UTC) touched by [start, end], inclusive —
 * e.g. Jan 15 to Mar 3 -> 3. Used to scale a monthly $ cap to whatever
 * date range is selected. */
export function monthsInRange(start: Date, end: Date): number {
  const startIndex = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const endIndex = end.getUTCFullYear() * 12 + end.getUTCMonth();
  return endIndex - startIndex + 1;
}
