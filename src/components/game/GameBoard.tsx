import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Clock, Hand, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { pingRoom, useNow, type Player, type Room } from "@/hooks/use-room";
import {
  allFilled,
  emptyAnswers,
  errorMessage,
  gameRound,
  isValidAnswer,
  roomCategories,
  secondsLeft,
  type Answers,
  type Category,
  type PlayerSession,
} from "@/lib/game";
import { callStop, finishRound, saveAnswers, timeUpRound } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

function loadAnswers(key: string, cats: Category[]): Answers {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return { ...emptyAnswers(cats), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyAnswers(cats);
}

export function GameBoard({ room, players, session, online }: Props) {
  const round = room.round_number;
  const letter = room.current_letter ?? "?";
  const storageKey = `stop:answers:${room.code}:${round}`;
  const cats = useMemo(() => roomCategories(room.categories), [room.categories]);
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(storageKey, cats));
  const [stopping, setStopping] = useState(false);
  const queryClient = useQueryClient();
  const latest = useRef(answers);
  latest.current = answers;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const stopped = room.status === "stopped";
  const isHost = room.host_player_id === session.playerId;
  const now = useNow(500);
  const left = secondsLeft(room.round_started_at, room.round_seconds, now);
  const timeUp = left === 0;
  // Time over locks this phone at once; the server closes the round for everyone.
  const locked = stopped || timeUp;
  const filledCount = cats.filter((c) => (answers[c.key] ?? "").trim()).length;
  const canStop = allFilled(answers, cats) && !locked;

  // Persist locally and autosave to the server while typing.
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(answers));
    if (locked) return;
    const t = setTimeout(() => {
      saveAnswers(session, round, answers).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, storageKey, locked, session, round]);

  // Leaving for WhatsApp (or locking the phone): send answers right away so nothing is lost.
  useEffect(() => {
    if (stopped) return;
    const flush = () => {
      if (document.visibilityState === "hidden") saveAnswers(session, round, latest.current).catch(() => {});
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [stopped, session, round]);

  // When anyone calls STOP: send final answers now (server accepts them for 3s), then score.
  // The host scores after the window; others retry later in case the host is away.
  useEffect(() => {
    if (!stopped) return;
    navigator.vibrate?.([120, 60, 220]);
    (document.activeElement as HTMLElement | null)?.blur?.();
    saveAnswers(session, round, latest.current).catch(() => {});
    let retry: ReturnType<typeof setInterval> | undefined;
    const finish = () => finishRound(session).catch(() => {});
    const t = setTimeout(
      () => {
        finish();
        retry = setInterval(finish, isHost ? 3000 : 4000);
      },
      isHost ? 3500 : 9000,
    );
    return () => {
      clearTimeout(t);
      if (retry) clearInterval(retry);
    };
  }, [stopped, session, round, isHost]);

  // Clock ran out: send final answers, then ask the server to close the round (retried until it does).
  useEffect(() => {
    if (!timeUp || stopped) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    saveAnswers(session, round, latest.current).catch(() => {});
    const close = () =>
      timeUpRound(session, round)
        .then(() => {
          pingRoom(room.id);
          queryClient.invalidateQueries({ queryKey: ["room", room.code] });
        })
        .catch(() => {});
    const t = setTimeout(close, 600);
    const retry = setInterval(close, 2000);
    return () => {
      clearTimeout(t);
      clearInterval(retry);
    };
  }, [timeUp, stopped, session, round, room.id, room.code, queryClient]);

  const setAnswer = (key: string, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const onStop = async () => {
    setStopping(true);
    try {
      await callStop(session, round, latest.current);
      pingRoom(room.id);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      queryClient.invalidateQueries({ queryKey: ["room", room.code] });
      setStopping(false);
    }
  };

  const stopper = players.find((p) => p.id === room.stopped_by);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-40 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <div>
        <LetterHeader
          letter={letter}
          round={gameRound(room)}
          maxRounds={room.max_rounds}
          startedAt={room.round_started_at}
          left={left}
          now={now}
          stopped={locked}
        />

        <ul className="mt-4 space-y-3">
          {cats.map((c, i) => {
            const value = answers[c.key] ?? "";
            const valid = isValidAnswer(value, letter);
            const filled = value.trim().length > 0;
            return (
              <li
                key={c.key}
                className={cn(
                  "surface relative flex items-center gap-3 p-3",
                  c.featured && "mt-5 border-cat-12 shadow-sogra",
                )}
              >
                {c.featured && (
                  <span className="absolute -top-3 left-4 -rotate-3 rounded-full bg-sogra-gradient px-3 py-0.5 font-display text-xs tracking-wide text-primary-foreground shadow-md">
                    😂 Categoria da zoeira
                  </span>
                )}
                <span
                  className={cn(
                    "grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl",
                    c.featured ? "animate-wobble bg-sogra-gradient" : `bg-${c.color}`,
                  )}
                  aria-hidden
                >
                  {c.emoji}
                </span>
                <label className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="shrink-0 font-display text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                    <span className="truncate font-display text-base">{c.label}</span>
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{c.hint}</span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    value={value}
                    disabled={locked}
                    maxLength={40}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize={c.featured ? "sentences" : "words"}
                    spellCheck={false}
                    enterKeyHint={i === cats.length - 1 ? "done" : "next"}
                    placeholder={`${letter}…`}
                    aria-label={c.label}
                    onChange={(e) => setAnswer(c.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = inputs.current[i + 1];
                        if (next) next.focus();
                        else (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="mt-1.5 h-12 w-full rounded-xl border-2 border-input bg-background px-3 text-lg font-bold outline-none placeholder:text-muted-foreground/50 focus:border-primary disabled:opacity-70"
                  />
                </label>
                <span className="w-6 shrink-0" aria-hidden>
                  {filled &&
                    (valid ? (
                      <Check className="h-6 w-6 text-success" />
                    ) : (
                      <TriangleAlert className="h-5 w-5 text-primary" />
                    ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <aside className="mt-6 lg:mt-0">
        <div className="lg:sticky lg:top-20">
          <Scoreboard players={players} hostId={room.host_player_id} meId={session.playerId} online={online} compact />
        </div>
      </aside>

      {/* STOP bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-border bg-background/90 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto max-w-md">
          <div
            className="mb-2 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={cats.length}
            aria-valuenow={filledCount}
          >
            <div
              className="h-full rounded-full bg-success transition-[width] duration-300"
              style={{ width: `${(filledCount / cats.length) * 100}%` }}
            />
          </div>
          <p className="mb-2 text-center text-sm font-bold text-muted-foreground">
            {canStop
              ? "Tudo preenchido! Mande o STOP!"
              : `${filledCount}/${cats.length} preenchidas — complete para pedir STOP`}
          </p>
          <Button
            variant="stop"
            size="giant"
            onClick={onStop}
            disabled={!canStop || stopping}
            className={cn(canStop && "animate-pulse-ring")}
          >
            {stopping ? <Loader2 className="!size-10 animate-spin" /> : <Hand className="!size-10" />}
            STOP!
          </Button>
        </div>
      </div>

      {locked && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 px-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto grid h-44 w-44 animate-slam place-items-center rounded-full bg-stop-gradient shadow-[0_10px_0_var(--stop-shade)]">
              <span className="font-display text-6xl text-stop-foreground">STOP!</span>
            </div>
            <p className="mt-8 font-display text-2xl">
              {stopper ? `${stopper.name} pediu STOP!` : room.round_seconds ? "⏰ Tempo esgotado!" : "STOP!"}
            </p>
            <p className="mt-2 flex items-center justify-center gap-2 font-bold text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Contando os pontos…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LetterHeader({
  letter,
  round,
  maxRounds,
  startedAt,
  left,
  now,
  stopped,
}: {
  letter: string;
  round: number;
  maxRounds: number | null;
  startedAt: string | null;
  left: number | null;
  now: number;
  stopped: boolean;
}) {
  const shown = left ?? (startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0);
  const mm = String(Math.floor(shown / 60)).padStart(2, "0");
  const ss = String(shown % 60).padStart(2, "0");
  const hurry = left != null && left <= 10 && !stopped;
  return (
    <div className="surface relative flex items-center gap-4 overflow-hidden p-4">
      <div
        key={letter}
        className="grid h-24 w-24 shrink-0 animate-pop-in place-items-center rounded-3xl bg-letter-gradient shadow-[0_6px_0_var(--primary-shade)]"
      >
        <span className="font-display text-7xl leading-none text-primary-foreground">{letter}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
          Rodada {round}
          {maxRounds ? ` de ${maxRounds}` : ""}
        </p>
        <p className="font-display text-2xl leading-tight">
          Letra <span className="text-primary">{letter}</span>
        </p>
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-sm font-bold tabular-nums",
            hurry ? "animate-pulse text-lg text-destructive" : "text-accent",
          )}
        >
          <Clock className="h-4 w-4" />
          {stopped ? "Tempo esgotado" : left != null ? `Faltam ${mm}:${ss}` : `${mm}:${ss}`}
        </p>
      </div>
    </div>
  );
}
