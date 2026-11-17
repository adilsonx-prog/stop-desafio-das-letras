import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Crown,
  Hash,
  ListChecks,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Save,
  Settings2,
  Type,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Player, Room } from "@/hooks/use-room";
import {
  ALPHABET,
  CATEGORIES,
  customCategoryKey,
  DEFAULT_LETTERS,
  errorMessage,
  HARD_LETTERS,
  MAX_CATEGORIES,
  MIN_CATEGORIES,
  MIN_LETTERS,
  ROUND_COUNT_OPTIONS,
  ROUND_TIME_OPTIONS,
  roundCountLabel,
  roundTimeLabel,
  validateRules,
  type PlayerSession,
  type RoomCategory,
} from "@/lib/game";
import { startRound, updateRoomSettings } from "@/lib/game-api";
import { cn } from "@/lib/utils";
import { ShareInvite } from "./ShareInvite";

interface Props {
  room: Room;
  players: Player[];
  session: PlayerSession;
  online: Set<string>;
}

function parseRoomCategories(raw: unknown): RoomCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return CATEGORIES.map((c) => ({ key: c.key, label: c.label }));
  }
  return raw
    .filter((c): c is RoomCategory => !!c && typeof c.key === "string" && typeof c.label === "string")
    .map((c) => ({ key: c.key, label: c.label }));
}

function parseRoomLetters(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_LETTERS];
  const valid = raw.map((l) => String(l).toUpperCase()).filter((l) => ALPHABET.includes(l));
  return valid.length >= MIN_LETTERS ? Array.from(new Set(valid)) : [...DEFAULT_LETTERS];
}

export function Lobby({ room, players, session, online }: Props) {
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const isHost = room.host_player_id === session.playerId;

  const r = room as Room & {
    categories?: unknown;
    letters?: unknown;
    round_seconds?: number | null;
    max_rounds?: number | null;
  };

  const [categories, setCategories] = useState<RoomCategory[]>(() => parseRoomCategories(r.categories));
  const [letters, setLetters] = useState<string[]>(() => parseRoomLetters(r.letters));
  const [roundSeconds, setRoundSeconds] = useState<number | null>(() =>
    ROUND_TIME_OPTIONS.includes(r.round_seconds ?? null) ? (r.round_seconds ?? null) : 90,
  );
  const [maxRounds, setMaxRounds] = useState<number | null>(() =>
    ROUND_COUNT_OPTIONS.includes(r.max_rounds ?? null) ? (r.max_rounds ?? null) : 5,
  );

  // Sync local state when room settings update from Supabase (if host has no unsaved edits).
  useEffect(() => {
    if (isHost && dirty) return;
    setCategories(parseRoomCategories(r.categories));
    setLetters(parseRoomLetters(r.letters));
    setRoundSeconds(ROUND_TIME_OPTIONS.includes(r.round_seconds ?? null) ? (r.round_seconds ?? null) : 90);
    setMaxRounds(ROUND_COUNT_OPTIONS.includes(r.max_rounds ?? null) ? (r.max_rounds ?? null) : 5);
  }, [r.categories, r.letters, r.round_seconds, r.max_rounds, isHost, dirty]);

  const toggleLetter = (letter: string) => {
    if (!isHost) return;
    setDirty(true);
    setLetters((prev) => {
      if (prev.includes(letter)) {
        if (prev.length <= MIN_LETTERS) {
          toast.error(`Deixe pelo menos ${MIN_LETTERS} letras no sorteio.`);
          return prev;
        }
        return prev.filter((l) => l !== letter);
      }
      return ALPHABET.filter((l) => prev.includes(l) || l === letter);
    });
  };

  const setNoHardLetters = () => {
    setDirty(true);
    setLetters([...DEFAULT_LETTERS]);
  };

  const setAllLetters = () => {
    setDirty(true);
    setLetters([...ALPHABET]);
  };

  const removeCategory = (key: string) => {
    if (!isHost) return;
    if (categories.length <= MIN_CATEGORIES) {
      toast.error(`Mantenha pelo menos ${MIN_CATEGORIES} categorias.`);
      return;
    }
    setDirty(true);
    setCategories((prev) => prev.filter((c) => c.key !== key));
  };

  const addCategory = () => {
    if (!isHost) return;
    const label = newCategory.trim();
    if (label.length < 2) {
      toast.error("Digite pelo menos 2 letras para a categoria.");
      return;
    }
    if (categories.length >= MAX_CATEGORIES) {
      toast.error(`Máximo de ${MAX_CATEGORIES} categorias por sala.`);
      return;
    }
    setDirty(true);
    setCategories((prev) => [...prev, { key: customCategoryKey(), label }]);
    setNewCategory("");
  };

  const restoreDefaultCategories = () => {
    setDirty(true);
    setCategories(CATEGORIES.map((c) => ({ key: c.key, label: c.label })));
  };

  const saveSettings = async (): Promise<boolean> => {
    const rules = { categories, letters, roundSeconds, maxRounds };
    const invalid = validateRules(rules);
    if (invalid) {
      toast.error(invalid);
      return false;
    }
    setSaving(true);
    try {
      await updateRoomSettings(session, rules);
      setDirty(false);
      toast.success("Configurações da sala salvas!");
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const start = async () => {
    setStarting(true);
    try {
      if (isHost && dirty) {
        const ok = await saveSettings();
        if (!ok) {
          setStarting(false);
          return;
        }
      }
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

      <section className="surface space-y-5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg">
            <Settings2 className="h-5 w-5 text-primary" /> Configurações da partida
          </h2>
          {!isHost && <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold">Só anfitrião</span>}
        </div>

        {/* Tempo por rodada */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Tempo por rodada
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_TIME_OPTIONS.map((opt) => {
              const selected = roundSeconds === opt;
              return (
                <button
                  key={String(opt)}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    setDirty(true);
                    setRoundSeconds(opt);
                  }}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/60 text-foreground",
                    !isHost && "cursor-default opacity-90",
                  )}
                >
                  {roundTimeLabel(opt)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantidade de rodadas */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            <Hash className="h-3.5 w-3.5" /> Número de rodadas
          </label>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_COUNT_OPTIONS.map((opt) => {
              const selected = maxRounds === opt;
              return (
                <button
                  key={String(opt)}
                  type="button"
                  disabled={!isHost}
                  onClick={() => {
                    setDirty(true);
                    setMaxRounds(opt);
                  }}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-xs font-extrabold transition-colors",
                    selected
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-border bg-muted/60 text-foreground",
                    !isHost && "cursor-default opacity-90",
                  )}
                >
                  {roundCountLabel(opt)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Letras do sorteio */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <Type className="h-3.5 w-3.5" /> Letras ({letters.length}/{ALPHABET.length})
            </label>
            {isHost && (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={setNoHardLetters}
                  className="rounded-lg bg-muted px-2 py-1 text-[11px] font-extrabold text-foreground hover:bg-muted/80"
                >
                  Sem difíceis
                </button>
                <button
                  type="button"
                  onClick={setAllLetters}
                  className="rounded-lg bg-muted px-2 py-1 text-[11px] font-extrabold text-foreground hover:bg-muted/80"
                >
                  Todas
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {ALPHABET.map((letter) => {
              const active = letters.includes(letter);
              const isHard = HARD_LETTERS.includes(letter);
              return (
                <button
                  key={letter}
                  type="button"
                  disabled={!isHost}
                  onClick={() => toggleLetter(letter)}
                  aria-pressed={active}
                  title={isHard ? `${letter} (letra difícil)` : letter}
                  className={cn(
                    "grid h-9 place-items-center rounded-lg border-2 font-display text-sm transition-all",
                    active
                      ? "border-success bg-success text-success-foreground shadow-xs"
                      : "border-border bg-muted/40 text-muted-foreground opacity-55",
                    !isHost && "cursor-default",
                  )}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categorias */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              <ListChecks className="h-3.5 w-3.5" /> Categorias ({categories.length}/{MAX_CATEGORIES})
            </label>
            {isHost && (
              <button
                type="button"
                onClick={restoreDefaultCategories}
                className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-extrabold text-foreground hover:bg-muted/80"
              >
                <RotateCcw className="h-3 w-3" /> Padrão
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <span
                key={cat.key}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold"
              >
                {cat.label}
                {isHost && (
                  <button
                    type="button"
                    onClick={() => removeCategory(cat.key)}
                    aria-label={`Remover ${cat.label}`}
                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>

          {isHost && categories.length < MAX_CATEGORIES && (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="Nova categoria (ex.: Banda, País…)"
                maxLength={28}
                className="h-10 flex-1 rounded-xl border-2 border-border bg-background px-3 text-sm font-semibold focus:border-primary focus:outline-none"
              />
              <Button type="button" variant="soft" className="h-10 rounded-xl px-3" onClick={addCategory}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>
          )}
        </div>

        {isHost && (
          <Button
            type="button"
            variant={dirty ? "pop" : "soft"}
            className="h-11 w-full rounded-xl font-extrabold"
            onClick={saveSettings}
            disabled={saving || !dirty}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : dirty ? (
              <Save className="h-4 w-4" />
            ) : (
              <Check className="h-4 w-4 text-success" />
            )}
            {dirty ? "Salvar configurações" : "Configurações salvas"}
          </Button>
        )}
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
          Depois do STOP tem conferência: qualquer jogador pode contestar uma resposta, e o anfitrião decide se ela vale
          ou é anulada.
        </p>
      </section>

      <div className="sticky bottom-4">
        {isHost ? (
          <Button variant="teal" size="xl" className="h-16 text-xl" onClick={start} disabled={starting || saving}>
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
