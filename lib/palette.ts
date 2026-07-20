// Categorical chart palette — the 8 dark-mode hues from the dataviz reference,
// validated against our surface (#191c22): all checks pass. Assigned in fixed
// order by a stable per-entity key (never by rank), overflow folds to "Other".

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
  surface: "#191c22",
  grid: "#2c2c2a",
  axis: "#383835",
  textPrimary: "#e6e8eb",
  textMuted: "#8b909a",
  positive: "#0ca30c",
  negative: "#d03b3b",
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
