import { useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRoundAnswers, type Player, type Room } from "@/hooks/use-room";
import { CATEGORIES, errorMessage, type PlayerSession } from "@/lib/game";
import { resetRoom, startRound } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

function PointsBadge({ pts }: { pts: number }) {
  return (
    <span
      className={cn(
        "min-w-10 rounded-full px-2 py-0.5 text-center text-sm font-extrabold tabular-nums",
        pts === 10 && "bg-success text-success-foreground",
        pts === 5 && "bg-primary text-primary-foreground",
        pts === 0 && "bg-muted text-muted-foreground",
      )}
    >
      {pts}
    </span>
  );
}

export function Results({ room, players, session, online }: Props) {
  const isHost = room.host_player_id === session.playerId;
  const { data: answers, isLoading } = useRoundAnswers(room.id, room.round_number, true);
  const [busy, setBusy] = useState<"next" | "reset" | null>(null);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Jogador saiu";
  const me = answers?.find((a) => a.player_id === session.playerId);

  const run = async (kind: "next" | "reset") => {
    if (kind === "reset" && !window.confirm("Zerar o placar e voltar para a sala de espera?")) return;
    setBusy(kind);
    try {
      await (kind === "next" ? startRound(session) : resetRoom(session));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-36 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <div className="space-y-4">
        <div className="surface flex items-center gap-4 p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-letter-gradient shadow-[0_5px_0_var(--primary-shade)]">
            <span className="font-display text-5xl leading-none text-primary-foreground">{room.current_letter}</span>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              Resultado da rodada {room.round_number}
            </p>
            <p className="font-display text-2xl">
              Você fez <span className="text-success">{me?.total ?? 0}</span> pontos
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="surface grid place-items-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <section key={c.key} className="surface overflow-hidden">
                <header className={cn("flex items-center gap-2 px-4 py-2 text-primary-foreground", `bg-${c.color}`)}>
                  <span aria-hidden>{c.emoji}</span>
                  <h3 className="font-display text-base">{c.label}</h3>
                </header>
                <ul className="divide-y-2 divide-border">
                  {(answers ?? []).map((a) => {
                    const value = ((a.answers as Record<string, string>)[c.key] ?? "").trim();
                    const pts = Number((a.points as Record<string, number>)[c.key] ?? 0);
                    return (
                      <li key={a.id} className="flex items-center gap-3 px-4 py-2">
                        <span className="w-20 shrink-0 truncate text-xs font-bold text-muted-foreground">
                          {nameOf(a.player_id)}
                        </span>
                        <span className={cn("flex-1 truncate font-bold", !value && "italic text-muted-foreground")}>
                          {value || "—"}
                        </span>
                        <PointsBadge pts={pts} />
                      </li>
                    );
                  })}
                  {answers?.length === 0 && <li className="px-4 py-3 text-sm text-muted-foreground">Sem respostas</li>}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <aside className="mt-6 lg:mt-0">
        <div className="lg:sticky lg:top-20">
          <Scoreboard
            players={players}
            hostId={room.host_player_id}
            meId={session.playerId}
            online={online}
            showRoundPoints
          />
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {isHost ? (
            <div className="flex gap-3">
              <Button
                variant="soft"
                className="h-16 w-16 shrink-0 rounded-2xl"
                onClick={() => run("reset")}
                disabled={!!busy}
                aria-label="Zerar placar"
              >
                {busy === "reset" ? <Loader2 className="!size-5 animate-spin" /> : <RotateCcw className="!size-5" />}
              </Button>
              <Button variant="teal" size="xl" className="h-16 text-xl" onClick={() => run("next")} disabled={!!busy}>
                {busy === "next" ? <Loader2 className="!size-6 animate-spin" /> : <Play className="!size-6" />}
                Próxima rodada
              </Button>
            </div>
          ) : (
            <p className="py-4 text-center font-bold text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              Aguardando o anfitrião iniciar a próxima rodada…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
