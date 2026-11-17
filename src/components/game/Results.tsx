import { useMemo, useState } from "react";
import { Ban, Check, CheckCheck, Flag, Loader2, Play, RotateCcw, ShieldCheck, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useDisputes, useRoundAnswers, type Player, type Room } from "@/hooks/use-room";
import { errorMessage, gameRound, roomCategories, roundsDone, type PlayerSession } from "@/lib/game";
import { confirmRound, endGame, resetRoom, ruleAnswer, startRound, toggleDispute } from "@/lib/game-api";
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

/** Round review (status "review": players flag answers, the host rules them) and confirmed results ("results"). */
export function Results({ room, players, session, online }: Props) {
  const reviewing = room.status === "review";
  const isHost = room.host_player_id === session.playerId;
  const cats = useMemo(() => roomCategories(room.categories), [room.categories]);
  const { data: answers, isLoading } = useRoundAnswers(room.id, room.round_number, true, room.updated_at);
  const { data: disputes } = useDisputes(room.id, room.round_number, room.updated_at);
  const [busy, setBusy] = useState<string | null>(null);
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "Jogador saiu";
  const me = answers?.find((a) => a.player_id === session.playerId);
  const round = gameRound(room);
  const lastRound = roundsDone(room);

  // Contested answers still waiting for the host's decision.
  const pending = (answers ?? []).reduce((n, a) => {
    const flagged = new Set(
      (disputes ?? []).filter((d) => d.target_player_id === a.player_id).map((d) => d.category),
    );
    return n + [...flagged].filter((k) => !(a.rejected ?? []).includes(k) && !(a.kept ?? []).includes(k)).length;
  }, 0);

  const run = async (kind: string, fn: () => Promise<void>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-40 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <div className="space-y-4">
        <div className="surface flex items-center gap-4 p-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-letter-gradient shadow-[0_5px_0_var(--primary-shade)]">
            <span className="font-display text-5xl leading-none text-primary-foreground">{room.current_letter}</span>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
              {reviewing ? "Conferência da rodada" : "Resultado da rodada"} {round}
              {room.max_rounds ? ` de ${room.max_rounds}` : ""}
            </p>
            <p className="font-display text-2xl">
              Você fez <span className="text-success">{isLoading ? "…" : (me?.total ?? 0)}</span> pontos
            </p>
          </div>
        </div>

        {reviewing && (
          <div className="surface border-accent p-4 text-sm">
            <p className="font-display text-base text-accent">🔎 Hora de conferir!</p>
            <p className="mt-1">
              Achou que uma resposta não vale? Toque em <b>Contestar</b> para avisar todo mundo.{" "}
              {isHost ? (
                <>
                  Você é o anfitrião: em cada resposta contestada, escolha <b>Anular (0 pts)</b> ou{" "}
                  <b>Manter válida</b>.
                </>
              ) : (
                <>Quem decide se ela é anulada ou mantida é o anfitrião.</>
              )}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="surface grid place-items-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {cats.map((c) => (
              <section
                key={c.key}
                className={cn("surface overflow-hidden", c.featured && "border-cat-12 shadow-sogra sm:col-span-2")}
              >
                <header
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-primary-foreground",
                    c.featured ? "bg-sogra-gradient" : `bg-${c.color}`,
                  )}
                >
                  <span aria-hidden>{c.emoji}</span>
                  <h3 className="font-display text-base">{c.label}</h3>
                  {c.featured && (
                    <span className="ml-auto text-sm" aria-hidden>
                      😂
                    </span>
                  )}
                </header>
                <ul className="divide-y-2 divide-border">
                  {(answers ?? []).map((a) => {
                    const value = ((a.answers as Record<string, string>)[c.key] ?? "").trim();
                    const pts = Number((a.points as Record<string, number>)[c.key] ?? 0);
                    const annulled = (a.rejected ?? []).includes(c.key);
                    const kept = (a.kept ?? []).includes(c.key);
                    const flags = (disputes ?? []).filter(
                      (d) => d.target_player_id === a.player_id && d.category === c.key,
                    );
                    const contested = flags.length > 0;
                    const mine = flags.some((d) => d.voter_player_id === session.playerId);
                    const canContest = reviewing && !!value && a.player_id !== session.playerId;
                    const key = `${a.player_id}:${c.key}`;
                    const who = nameOf(a.player_id);
                    return (
                      <li key={a.id} className={cn("px-3 py-2", contested && reviewing && "bg-destructive/5")}>
                        <div className="flex items-center gap-2">
                          <span className="w-20 shrink-0 truncate text-xs font-bold text-muted-foreground">{who}</span>
                          <span
                            className={cn(
                              "min-w-0 flex-1 truncate font-bold",
                              !value && "italic text-muted-foreground",
                              annulled && "text-muted-foreground line-through",
                            )}
                          >
                            {value || "—"}
                          </span>
                          {canContest && (
                            <button
                              type="button"
                              onClick={() => run(key, () => toggleDispute(session, a.player_id, c.key))}
                              disabled={busy === key}
                              aria-pressed={mine}
                              aria-label={`${mine ? "Retirar contestação" : "Contestar"}: ${who} – ${c.label}`}
                              className={cn(
                                "flex h-9 shrink-0 items-center gap-1 rounded-full border-2 px-2.5 text-xs font-extrabold transition-colors",
                                mine
                                  ? "border-destructive bg-destructive text-destructive-foreground"
                                  : "border-border bg-muted text-muted-foreground",
                              )}
                            >
                              {busy === key ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Ban className="h-3.5 w-3.5" />
                              )}
                              {mine ? "Contestei" : "Contestar"}
                            </button>
                          )}
                          {!reviewing && annulled && (
                            <span className="shrink-0 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-extrabold text-destructive">
                              anulada
                            </span>
                          )}
                          <PointsBadge pts={pts} />
                        </div>

                        {contested && reviewing && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-[5.5rem] max-sm:pl-0">
                            <span className="flex items-center gap-1 text-xs font-extrabold text-destructive">
                              ⚠️ Contestada por {flags.map((d) => nameOf(d.voter_player_id)).join(", ")}
                            </span>
                            {isHost ? (
                              <div className="flex w-full gap-2">
                                <button
                                  type="button"
                                  onClick={() => run(`${key}:annul`, () => ruleAnswer(session, a.player_id, c.key, "annul"))}
                                  disabled={!!busy}
                                  aria-pressed={annulled}
                                  aria-label={`Anular: ${who} – ${c.label}`}
                                  className={cn(
                                    "flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border-2 text-sm font-extrabold transition-colors",
                                    annulled
                                      ? "border-destructive bg-destructive text-destructive-foreground"
                                      : "border-destructive/50 bg-background text-destructive",
                                  )}
                                >
                                  {busy === `${key}:annul` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                  Anular (0 pts)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => run(`${key}:keep`, () => ruleAnswer(session, a.player_id, c.key, "keep"))}
                                  disabled={!!busy}
                                  aria-pressed={kept}
                                  aria-label={`Manter válida: ${who} – ${c.label}`}
                                  className={cn(
                                    "flex h-10 flex-1 items-center justify-center gap-1 rounded-xl border-2 text-sm font-extrabold transition-colors",
                                    kept
                                      ? "border-success bg-success text-success-foreground"
                                      : "border-success/50 bg-background text-success",
                                  )}
                                >
                                  {busy === `${key}:keep` ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  Manter válida
                                </button>
                              </div>
                            ) : (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                                  annulled && "bg-destructive/15 text-destructive",
                                  kept && "bg-success/15 text-success",
                                  !annulled && !kept && "bg-muted text-muted-foreground",
                                )}
                              >
                                {annulled ? "anulada pelo anfitrião" : kept ? "mantida pelo anfitrião" : "aguardando o anfitrião"}
                              </span>
                            )}
                          </div>
                        )}
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
            pendingRound={reviewing}
          />
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          {reviewing ? (
            isHost ? (
              <>
                {pending > 0 && (
                  <p className="mb-2 flex items-center justify-center gap-1 text-center text-sm font-bold text-destructive">
                    <ShieldCheck className="h-4 w-4" /> {pending} contestada{pending > 1 ? "s" : ""} esperando sua decisão
                  </p>
                )}
                <Button
                  variant="teal"
                  size="xl"
                  className="h-16 text-xl"
                  onClick={() =>
                    run(
                      "confirm",
                      () => confirmRound(session),
                      pending > 0
                        ? `Ainda há ${pending} resposta(s) contestada(s) sem decisão. Elas vão continuar valendo. Confirmar o resultado?`
                        : undefined,
                    )
                  }
                  disabled={!!busy}
                >
                  {busy === "confirm" ? <Loader2 className="!size-6 animate-spin" /> : <CheckCheck className="!size-6" />}
                  Confirmar resultado
                </Button>
              </>
            ) : (
              <p className="py-4 text-center font-bold text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Confira as respostas. O anfitrião vai decidir as contestações e confirmar.
              </p>
            )
          ) : isHost ? (
            <div className="flex gap-3">
              <Button
                variant="soft"
                className="h-16 w-16 shrink-0 rounded-2xl"
                onClick={() => run("reset", () => resetRoom(session), "Zerar o placar e voltar para a sala de espera?")}
                disabled={!!busy}
                aria-label="Zerar placar"
              >
                {busy === "reset" ? <Loader2 className="!size-5 animate-spin" /> : <RotateCcw className="!size-5" />}
              </Button>
              {lastRound ? (
                <Button
                  variant="teal"
                  size="xl"
                  className="h-16 text-xl"
                  onClick={() => run("end", () => endGame(session))}
                  disabled={!!busy}
                >
                  {busy === "end" ? <Loader2 className="!size-6 animate-spin" /> : <Trophy className="!size-6" />}
                  Ver pódio final
                </Button>
              ) : (
                <>
                  <Button
                    variant="soft"
                    className="h-16 w-16 shrink-0 rounded-2xl"
                    onClick={() => run("end", () => endGame(session), "Encerrar a partida e ver o pódio?")}
                    disabled={!!busy}
                    aria-label="Encerrar partida"
                  >
                    {busy === "end" ? <Loader2 className="!size-5 animate-spin" /> : <Flag className="!size-5" />}
                  </Button>
                  <Button
                    variant="teal"
                    size="xl"
                    className="h-16 text-xl"
                    onClick={() => run("next", () => startRound(session))}
                    disabled={!!busy}
                  >
                    {busy === "next" ? <Loader2 className="!size-6 animate-spin" /> : <Play className="!size-6" />}
                    Próxima rodada
                  </Button>
                </>
              )}
            </div>
          ) : (
            <p className="py-4 text-center font-bold text-muted-foreground">
              <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
              {lastRound
                ? "Essa foi a última rodada! Aguardando o anfitrião mostrar o pódio…"
                : "Aguardando o anfitrião iniciar a próxima rodada…"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
