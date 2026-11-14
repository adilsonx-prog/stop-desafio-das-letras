import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

/** Sun/moon switch. Changes the theme on this device only. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const light = theme === "light";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={light}
      aria-label={light ? "Mudar para tema escuro" : "Mudar para tema claro"}
      title={light ? "Tema escuro" : "Tema claro"}
      className={cn(
        "relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border-2 border-border bg-muted p-1 transition-colors",
        className,
      )}
    >
      <Sun className={cn("absolute left-2 h-4 w-4 transition-opacity", light ? "opacity-0" : "opacity-60")} aria-hidden />
      <Moon className={cn("absolute right-2 h-4 w-4 transition-opacity", light ? "opacity-60" : "opacity-0")} aria-hidden />
      <span
        className={cn(
          "grid h-7 w-7 place-items-center rounded-full shadow-md transition-transform duration-300",
          light ? "translate-x-0 bg-primary text-primary-foreground" : "translate-x-8 bg-accent text-accent-foreground",
        )}
        aria-hidden
      >
        {light ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </span>
    </button>
  );
}
