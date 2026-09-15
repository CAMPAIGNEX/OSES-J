/**
 * Light / dark preference. It is personal to the device, so it lives in localStorage and is mirrored into a
 * cookie: the cookie lets the root layout paint the right theme on the first byte (no flash), localStorage keeps
 * working in the browser when cookies are cleared. `public/theme-init.js` applies the same rules before hydration
 * for first-time visitors who have neither yet.
 */
export const THEME_COOKIE = "oses_theme";
export const THEME_STORAGE_KEY = "oses-theme";

export type ThemeMode = "light" | "dark";

export function normalizeTheme(value: string | null | undefined): ThemeMode | null {
  return value === "dark" || value === "light" ? value : null;
}

/** Applies a theme in the browser and persists it (class on <html>, localStorage, cookie). */
export function applyTheme(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark");
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* private mode or storage disabled */
  }
  document.cookie = `${THEME_COOKIE}=${mode}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
