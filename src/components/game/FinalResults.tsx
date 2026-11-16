import { useState } from "react";
import { Loader2, MessageCircle, RotateCcw, Share2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useGameHistory, type Player, type Room } from "@/hooks/use-room";
import { errorMessage, resultMessage, roomInviteUrl, type PlayerSession } from "@/lib/game";
import { resetRoom } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

const PODIUM = [
  { place: 2, medal: "🥈", height: "h-24", color: "bg-cat-7" },
  { place: 1, medal: "🥇", height: "h-32", color: "bg-letter-gradient" },
  { place: 3, medal: "🥉", height: "h-16", color: "bg-cat-6" },
];

export function FinalResults({ room, players, session, online }: Props) {
  const isHost = room.host_player_id === session.playerId;
  const [busy, setBusy] = useState(false);
  const ranking = [...players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  const top = ranking[0];
  const tied = ranking.filter((p) => top && p.score === top.score);
  const { data: history } = useGameHistory(room.id, room.game_start_round, room.updated_at);
  const rounds = [...new Set((history ?? []).map((h) => h.round_number))].sort((a, b) => a - b);
  const pointsOf = (playerId: string, round: number) =>
    history?.find((h) => h.player_id === playerId && h.round_number === round)?.total;

  const url = roomInviteUrl(room.code);
  const text = resultMessage(room.code, ranking, url.replace(/\/sala\/.*$/, ""));

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Resultado – STOP", text });
        return;
      } catch {
        return; /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resultado copiado!");
    } catch {
      toast.error("Não foi possível compartilhar.");
    }
  };

  const again = async () => {
    setBusy(true);
    try {
      await resetRoom(session);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-44">
      <section className="surface overflow-hidden p-5 text-center">
        <Trophy className="mx-auto h-10 w-10 animate-wobble text-primary" />
        <p className="mt-2 text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Fim de partida</p>
        <h1 className="font-display text-3xl leading-tight">
          {tied.length > 1 ? (
            <>Empate entre {tied.map((p) => p.name).join(" e ")}!</>
          ) : (
            <>
              <span className="text-primary">{top?.name ?? "—"}</span> venceu!
            </>
          )}
        </h1>
        <p className="mt-1 font-bold text-muted-foreground">{top?.score ?? 0} pontos</p>

        <div className="mt-6 grid grid-cols-3 items-end gap-2" aria-label="Pódio">
          {PODIUM.map((slot) => {
            const p = ranking[slot.place - 1];
            return (
              <div key={slot.place} className="flex min-w-0 flex-col items-center">
                {p ? (
                  <>
                    <span className="text-3xl" aria-hidden>
                      {slot.medal}
                    </span>
                    <span className="mt-1 w-full truncate font-display text-base">{p.name}</span>
                    <span className="text-sm font-extrabold text-muted-foreground tabular-nums">{p.score} pts</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
                <div
                  className={cn(
                    "mt-2 grid w-full animate-pop-in place-items-center rounded-t-2xl font-display text-3xl text-primary-foreground",
                    slot.height,
                    slot.color,
                  )}
                >
                  {slot.place}º
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Scoreboard players={players} hostId={room.host_player_id} meId={session.playerId} online={online} />

      {rounds.length > 0 && (
        <section className="surface overflow-hidden">
          <h2 className="px-4 pt-4 font-display text-lg">Pontos por rodada</h2>
          <div className="overflow-x-auto p-4">
            <table className="w-full min-w-max text-sm">
              <thead>
                <tr className="text-left text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                  <th className="py-1 pr-3">Jogador</th>
                  {rounds.map((r, i) => (
                    <th key={r} className="px-2 py-1 text-center">
                      R{i + 1}
                    </th>
                  ))}
                  <th className="py-1 pl-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((p) => (
                  <tr key={p.id} className={cn("border-t-2 border-border", p.id === session.playerId && "font-extrabold")}>
                    <td className="max-w-28 truncate py-2 pr-3 font-bold">{p.name}</td>
                    {rounds.map((r) => (
                      <td key={r} className="px-2 py-2 text-center tabular-nums">
                        {pointsOf(p.id, r) ?? "–"}
                      </td>
                    ))}
                    <td className="py-2 pl-2 text-right font-display text-base text-primary tabular-nums">{p.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="pop" className="h-12 rounded-xl text-base" onClick={share} aria-label="Compartilhar resultado">
              <Share2 /> Compartilhar
            </Button>
            <Button variant="soft" className="h-12 rounded-xl" asChild>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
                <MessageCircle /> WhatsApp
              </a>
            </Button>
          </div>
          {isHost ? (
            <Button variant="teal" size="xl" className="h-14 text-xl" onClick={again} disabled={busy}>
              {busy ? <Loader2 className="!size-6 animate-spin" /> : <RotateCcw className="!size-6" />}
              Jogar novamente
            </Button>
          ) : (
            <p className="text-center text-sm font-bold text-muted-foreground">
              O anfitrião pode começar uma nova partida com todo mundo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
