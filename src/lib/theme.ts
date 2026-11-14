export type Theme = "dark" | "light";

export const THEME_KEY = "stop:theme";
export const THEME_COLORS: Record<Theme, string> = { dark: "#141d3a", light: "#f3f5f9" };

export function parseTheme(value: string | null | undefined): Theme {
  return value === "light" ? "light" : "dark";
}

/**
 * Runs in <head> before the page paints so a saved light theme never flashes dark.
 * Kept as a plain string: it is injected as an inline script.
 */
export const themeBootScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")==="light"?"light":"dark";var r=document.documentElement;r.classList.remove("dark","light");r.classList.add(t);r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"${THEME_COLORS.light}":"${THEME_COLORS.dark}");}catch(e){}})();`;

/** Applies the theme on this device only and remembers it. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  root.classList.add(theme);
  root.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode: theme still applies for this visit */
  }
  window.dispatchEvent(new CustomEvent("stop:theme", { detail: theme }));
}

export function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("light") ? "light" : "dark";
}
