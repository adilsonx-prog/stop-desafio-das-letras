import { useState } from "react";
import { Crown, Loader2, Play, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Player, Room } from "@/hooks/use-room";
import { errorMessage, type PlayerSession } from "@/lib/game";
import { startRound } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { ShareInvite } from "./ShareInvite";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

export function Lobby({ room, players, session, online }: Props) {
  const [starting, setStarting] = useState(false);
  const isHost = room.host_player_id === session.playerId;

  const start = async () => {
    setStarting(true);
    try {
      await startRound(session);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-10">
      <section className="surface p-5 text-center">
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Código da sala</p>
        <div className="mt-3 flex justify-center gap-2">
          {room.code.split("").map((ch, i) => (
            <span
              key={i}
              className="grid h-14 w-12 animate-pop-in place-items-center rounded-xl bg-letter-gradient font-display text-3xl text-primary-foreground shadow-[0_4px_0_var(--primary-shade)]"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {ch}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Envie o convite para seus amigos entrarem.</p>
        <div className="mt-4">
          <ShareInvite code={room.code} />
        </div>
      </section>

      <section className="surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <Users className="h-5 w-5 text-accent" /> Jogadores
          </h2>
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-bold">{players.length}/15</span>
        </div>
        <ul className="space-y-2">
          {players.map((p, i) => (
            <li
              key={p.id}
              className="flex animate-pop-in items-center gap-3 rounded-xl bg-muted px-3 py-2.5"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full font-display text-lg text-primary-foreground",
                  `bg-cat-${(i % 9) + 1}`,
                )}
              >
                {p.name.charAt(0).toUpperCase()}
              </span>
              <span className="flex-1 truncate font-bold">
                {p.name}
                {p.id === session.playerId && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
              </span>
              {p.id === room.host_player_id && <Crown className="h-5 w-5 text-primary" aria-label="anfitrião" />}
              <span
                className={cn("h-2.5 w-2.5 rounded-full", online.has(p.id) ? "bg-success" : "bg-border")}
                aria-label={online.has(p.id) ? "online" : "offline"}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className="surface space-y-2 p-5 text-sm">
        <h3 className="font-display text-base text-accent">Como pontuar</h3>
        <p>
          <b className="text-success">10 pontos</b> — resposta só sua
        </p>
        <p>
          <b className="text-primary">5 pontos</b> — resposta repetida por outro jogador
        </p>
        <p>
          <b className="text-muted-foreground">0 pontos</b> — vazia ou com outra letra
        </p>
        <p className="text-muted-foreground">
          Depois do STOP tem conferência: a maioria dos jogadores pode anular uma resposta.
        </p>
      </section>

      <div className="sticky bottom-4">
        {isHost ? (
          <Button variant="teal" size="xl" className="h-16 text-xl" onClick={start} disabled={starting}>
            {starting ? <Loader2 className="!size-6 animate-spin" /> : <Play className="!size-6" />}
            Começar partida
          </Button>
        ) : (
          <div className="surface p-4 text-center font-bold text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
            Aguardando o anfitrião começar…
          </div>
        )}
      </div>
    </div>
  );
}
