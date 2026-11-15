import { Crown, Trophy } from "lucide-react";
import type { Player } from "@/hooks/use-room";
import { cn } from "@/lib/utils";

interface Props {
  players: Player[];
  hostId: string | null;
  meId: string;
  online?: Set<string>;
  showRoundPoints?: boolean;
  compact?: boolean;
  /** Round points not yet added to the score (review in progress). */
  pendingRound?: boolean;
}

const MEDALS = ["🥇", "🥈", "🥉"];

export function Scoreboard({ players, hostId, meId, online, showRoundPoints, compact, pendingRound }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg">Placar</h2>
      </div>
      <ol className={cn("space-y-2", compact && "space-y-1.5")}>
        {sorted.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3 rounded-xl bg-muted px-3 py-2",
              p.id === meId && "ring-2 ring-primary",
            )}
          >
            <span className="w-6 text-center font-display text-base text-muted-foreground">
              {p.score > 0 && MEDALS[i] ? MEDALS[i] : i + 1}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-1.5 font-bold">
              {online && (
                <span
                  className={cn("h-2 w-2 shrink-0 rounded-full", online.has(p.id) ? "bg-success" : "bg-border")}
                  aria-label={online.has(p.id) ? "online" : "offline"}
                />
              )}
              <span className="truncate">{p.name}</span>
              {p.id === hostId && <Crown className="h-4 w-4 shrink-0 text-primary" aria-label="anfitrião" />}
              {p.id === meId && <span className="text-xs font-semibold text-muted-foreground">(você)</span>}
            </span>
            {showRoundPoints && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-extrabold",
                  pendingRound ? "border-2 border-dashed border-success text-success" : "bg-success/20 text-success",
                )}
                title={pendingRound ? "Pontos da rodada (aguardando confirmação)" : undefined}
              >
                +{p.last_round_points}
              </span>
            )}
            <span className="font-display text-xl text-primary tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
