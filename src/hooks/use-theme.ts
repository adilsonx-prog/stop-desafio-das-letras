import { useCallback, useEffect, useState } from "react";
import { applyTheme, currentTheme, type Theme } from "@/lib/theme";

/** This device's theme. Never shared with other players. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    setThemeState(currentTheme());
    const onChange = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener("stop:theme", onChange);
    return () => window.removeEventListener("stop:theme", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => applyTheme(t), []);
  const toggle = useCallback(() => applyTheme(currentTheme() === "light" ? "dark" : "light"), []);

  return { theme, setTheme, toggle };
}
