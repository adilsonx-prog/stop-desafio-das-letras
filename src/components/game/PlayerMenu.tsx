import { LogOut, Moon, Sun, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { parseTheme } from "@/lib/theme";

export function PlayerMenu({ name, onLeave }: { name?: string | undefined; onLeave: () => void }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu do jogador">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-2xl border-2 p-2">
        {name && <DropdownMenuLabel className="truncate font-display text-base">{name}</DropdownMenuLabel>}
        <DropdownMenuLabel className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          Aparência (só no seu aparelho)
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(parseTheme(v))}>
          <DropdownMenuRadioItem value="light" className="h-11 rounded-xl font-bold">
            <Sun className="mr-2 h-4 w-4" /> Tema claro
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="h-11 rounded-xl font-bold">
            <Moon className="mr-2 h-4 w-4" /> Tema escuro
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onLeave} className="h-11 rounded-xl font-bold text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sair da sala
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
