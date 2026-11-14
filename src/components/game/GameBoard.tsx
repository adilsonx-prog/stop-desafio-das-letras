import { useEffect, useRef, useState } from "react";
import { Check, Clock, Hand, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNow, type Player, type Room } from "@/hooks/use-room";
import {
  allFilled,
  CATEGORIES,
  emptyAnswers,
  errorMessage,
  isValidAnswer,
  type Answers,
  type CategoryKey,
  type PlayerSession,
} from "@/lib/game";
import { callStop, finishRound, saveAnswers } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { Scoreboard } from "./Scoreboard";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

function loadAnswers(key: string): Answers {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return { ...emptyAnswers(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return emptyAnswers();
}

export function GameBoard({ room, players, session, online }: Props) {
  const round = room.round_number;
  const letter = room.current_letter ?? "?";
  const storageKey = `stop:answers:${room.code}:${round}`;
  const [answers, setAnswers] = useState<Answers>(() => loadAnswers(storageKey));
  const [stopping, setStopping] = useState(false);
  const latest = useRef(answers);
  latest.current = answers;
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const stopped = room.status === "stopped";
  const isHost = room.host_player_id === session.playerId;
  const filledCount = CATEGORIES.filter((c) => answers[c.key].trim()).length;
  const canStop = allFilled(answers) && !stopped;

  // Persist locally and autosave to the server while typing.
  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(answers));
    if (stopped) return;
    const t = setTimeout(() => {
      saveAnswers(session, round, answers).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [answers, storageKey, stopped, session, round]);

  // When anyone calls STOP: send final answers now, then score the round.
  useEffect(() => {
    if (!stopped) return;
    navigator.vibrate?.([120, 60, 220]);
    saveAnswers(session, round, latest.current).catch(() => {});
    const t = setTimeout(
      () => {
        finishRound(session).catch(() => {});
      },
      isHost ? 2500 : 9000,
    );
    return () => clearTimeout(t);
  }, [stopped, session, round, isHost]);

  const setAnswer = (key: CategoryKey, value: string) => setAnswers((a) => ({ ...a, [key]: value }));

  const onStop = async () => {
    setStopping(true);
    try {
      await callStop(session, round, latest.current);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setStopping(false);
    }
  };

  const stopper = players.find((p) => p.id === room.stopped_by);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-40 lg:grid lg:grid-cols-[1fr_320px] lg:gap-6">
      <div>
        <LetterHeader letter={letter} round={round} startedAt={room.round_started_at} stopped={stopped} />

        <ul className="mt-4 space-y-3">
          {CATEGORIES.map((c, i) => {
            const value = answers[c.key];
            const valid = isValidAnswer(value, letter);
            const filled = value.trim().length > 0;
            return (
              <li key={c.key} className="surface flex items-center gap-3 p-3">
                <span
                  className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-2xl", `bg-${c.color}`)}
                  aria-hidden
                >
                  {c.emoji}
                </span>
                <label className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="font-display text-base">{c.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.hint}</span>
                  </span>
                  <input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    value={value}
                    disabled={stopped}
                    maxLength={40}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    enterKeyHint={i === CATEGORIES.length - 1 ? "done" : "next"}
                    placeholder={`${letter}…`}
                    onChange={(e) => setAnswer(c.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = inputs.current[i + 1];
                        if (next) next.focus();
                        else (e.target as HTMLInputElement).blur();
                      }
                    }}
                    className="mt-1 h-11 w-full rounded-lg border-2 border-input bg-background px-3 text-lg font-bold outline-none placeholder:text-muted-foreground/50 focus:border-primary disabled:opacity-70"
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
          <p className="mb-2 text-center text-sm font-bold text-muted-foreground">
            {canStop ? "Tudo preenchido! Mande o STOP!" : `${filledCount}/9 preenchidas — complete para pedir STOP`}
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

      {stopped && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/85 px-6 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto grid h-44 w-44 animate-slam place-items-center rounded-full bg-stop-gradient shadow-[0_10px_0_var(--stop-shade)]">
              <span className="font-display text-6xl text-stop-foreground">STOP!</span>
            </div>
            <p className="mt-8 font-display text-2xl">{stopper ? `${stopper.name} pediu STOP!` : "STOP!"}</p>
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
  startedAt,
  stopped,
}: {
  letter: string;
  round: number;
  startedAt: string | null;
  stopped: boolean;
}) {
  const now = useNow();
  const elapsed = startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000)) : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  return (
    <div className="surface relative flex items-center gap-4 overflow-hidden p-4">
      <div
        key={letter}
        className="grid h-24 w-24 shrink-0 animate-pop-in place-items-center rounded-3xl bg-letter-gradient shadow-[0_6px_0_var(--primary-shade)]"
      >
        <span className="font-display text-7xl leading-none text-primary-foreground">{letter}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground">Rodada {round}</p>
        <p className="font-display text-2xl leading-tight">
          Letra <span className="text-primary">{letter}</span>
        </p>
        <p className="mt-1 flex items-center gap-1 text-sm font-bold text-accent tabular-nums">
          <Clock className="h-4 w-4" /> {stopped ? "Tempo esgotado" : `${mm}:${ss}`}
        </p>
      </div>
    </div>
  );
}
