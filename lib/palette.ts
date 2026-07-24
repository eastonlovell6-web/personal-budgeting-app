// Money Moves fixed concept colors — 1:1 mapping, never reassigned or mixed
// across concepts. See claudemd/design-system.md.
export const CONCEPT = {
  income: "#2fa968",
  spending: "#eb4b4b",
  cashflow: "#17abda",
  savings: "#ffc53d",
  goals: "#cc3dc4",
} as const;

// Categorical chart palette — for multi-series breakdowns (e.g. spending by
// sub-category: Housing, Food, Transport) that aren't one of the 5 fixed
// concepts above. Deliberately independent of CONCEPT; the design system
// doesn't specify sub-category chart colors, so this wasn't touched in the
// 2026-07-24 color pass. Assigned in fixed order by a stable per-entity key
// (never by rank), overflow folds to "Other".
export const CATEGORICAL = [
  "#3987e5", // blue
  "#008300", // green
  "#d55181", // magenta
  "#c98500", // yellow
  "#199e70", // aqua
  "#d95926", // orange
  "#9085e9", // violet
  "#e66767", // red
] as const;

export const OTHER_COLOR = "#6b7280"; // muted gray for the folded tail

export const CHART = {
  surface: "#211f1b",
  grid: "#2b2a26",
  axis: "#3a3833",
  textPrimary: "#f6f4ef",
  textMuted: "#a9a69e",
  positive: CONCEPT.income,
  negative: CONCEPT.spending,
} as const;

/**
 * Assign colors to a fixed, stable list of entity keys (e.g. category names in
 * a canonical order). First 8 get distinct hues; the rest share OTHER_COLOR.
 * Color follows the entity's position in `orderedKeys`, not its data value.
 */
export function colorMap(orderedKeys: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  orderedKeys.forEach((key, i) => {
    map[key] = i < CATEGORICAL.length ? CATEGORICAL[i] : OTHER_COLOR;
  });
  return map;
}
