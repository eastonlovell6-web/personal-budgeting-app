export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";

export function readStoredTheme(raw: string | null): Theme {
  return raw === "light" ? "light" : "dark";
}

export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}
