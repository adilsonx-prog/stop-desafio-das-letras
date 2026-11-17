export type CategoryKey =
  | "nome"
  | "cidade"
  | "estado"
  | "cep"
  | "cor"
  | "comida"
  | "fruta"
  | "filme"
  | "sogra"
  | "animal"
  | "objeto"
  | "profissao"
  | "marca";

export interface Category {
  /** Built-in CategoryKey, or a custom key created by the host (c_xxxxxx). */
  key: string;
  label: string;
  hint: string;
  emoji: string;
  /** Tailwind color token suffix (cat-1..cat-13) */
  color: string;
  /** Gets the fun highlighted card. */
  featured?: boolean;
}

// Default list for new rooms. Must stay in sync with public.stop_categories() and the
// default of rooms.categories in the database.
export const CATEGORIES: (Category & { key: CategoryKey })[] = [
  { key: "nome", label: "Nome", hint: "Nome de pessoa", emoji: "🙋", color: "cat-1" },
  { key: "cidade", label: "Cidade", hint: "Qualquer cidade", emoji: "🏙️", color: "cat-10" },
  { key: "estado", label: "Estado ou País", hint: "Estado ou país", emoji: "🌎", color: "cat-11" },
  { key: "cep", label: "CEP", hint: "Cidade, Estado ou País", emoji: "🗺️", color: "cat-3" },
  { key: "cor", label: "Cor", hint: "Uma cor", emoji: "🎨", color: "cat-4" },
  { key: "comida", label: "Comida", hint: "Prato ou algo de comer", emoji: "🍝", color: "cat-6" },
  { key: "fruta", label: "Fruta", hint: "Uma fruta", emoji: "🍉", color: "cat-5" },
  { key: "filme", label: "Filme, Desenho ou Série", hint: "Título de filme, desenho ou série", emoji: "🎬", color: "cat-9" },
  {
    key: "sogra",
    label: "Minha sogra é…",
    hint: "Complete a frase (com a letra!)",
    emoji: "👵",
    color: "cat-12",
    featured: true,
  },
  { key: "animal", label: "Animal", hint: "Qualquer bicho", emoji: "🐾", color: "cat-2" },
  { key: "objeto", label: "Objeto", hint: "Uma coisa", emoji: "🧸", color: "cat-7" },
  { key: "profissao", label: "Profissão", hint: "Um trabalho", emoji: "👷", color: "cat-13" },
  { key: "marca", label: "Marca", hint: "Marca famosa", emoji: "🏷️", color: "cat-8" },
];

export type Answers = Record<string, string>;

export const emptyAnswers = (cats: Category[] = CATEGORIES): Answers =>
  Object.fromEntries(cats.map((c) => [c.key, ""])) as Answers;

/** Mirrors public.stop_normalize(): trims, lowercases, strips accents, collapses spaces. */
export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** An answer counts when it has 2+ characters and starts with the round letter (accents ignored). */
export function isValidAnswer(value: string, letter: string | null | undefined): boolean {
  if (!letter) return false;
  const n = normalizeAnswer(value);
  return n.length >= 2 && n[0] === normalizeAnswer(letter)[0];
}

export function allFilled(answers: Answers, cats: Category[] = CATEGORIES): boolean {
  return cats.every((c) => (answers[c.key] ?? "").trim().length > 0);
}

// ---------- Room rules (chosen by the host in the lobby) ----------

export interface RoomCategory {
  key: string;
  label: string;
}

export const MIN_CATEGORIES = 4;
export const MAX_CATEGORIES = 15;
export const MIN_LETTERS = 5;
export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
/** Letters drawn by default (hard ones K, Q, W, X, Y, Z left out). Mirrors rooms.letters default. */
export const DEFAULT_LETTERS = "ABCDEFGHIJLMNOPRSTUV".split("");
export const HARD_LETTERS = ["K", "Q", "W", "X", "Y", "Z"];
/** null = no time limit / play until the host ends the game. */
export const ROUND_TIME_OPTIONS: (number | null)[] = [60, 90, 120, null];
export const ROUND_COUNT_OPTIONS: (number | null)[] = [3, 5, 10, null];

const CUSTOM_COLORS = ["cat-1", "cat-3", "cat-4", "cat-6", "cat-9", "cat-10", "cat-11", "cat-13"];

/** Categories of a room, in play order, with display metadata. Falls back to the default list. */
export function roomCategories(raw: unknown): Category[] {
  if (!Array.isArray(raw) || raw.length === 0) return CATEGORIES;
  let custom = 0;
  return raw
    .filter((c): c is RoomCategory => !!c && typeof c.key === "string" && typeof c.label === "string")
    .map((c) => {
      const builtIn = CATEGORIES.find((b) => b.key === c.key);
      if (builtIn) return builtIn;
      const color = CUSTOM_COLORS[custom++ % CUSTOM_COLORS.length];
      return { key: c.key, label: c.label, hint: "Categoria da sala", emoji: "✏️", color };
    });
}

export function customCategoryKey(): string {
  return `c_${Math.random().toString(36).slice(2, 8)}`;
}

export interface RoomRules {
  categories: RoomCategory[];
  letters: string[];
  roundSeconds: number | null;
  maxRounds: number | null;
}

/** Same checks as public.update_room_settings(); returns a message, or null when valid. */
export function validateRules(r: RoomRules): string | null {
  const n = r.categories.length;
  if (n < MIN_CATEGORIES || n > MAX_CATEGORIES) return `Escolha de ${MIN_CATEGORIES} a ${MAX_CATEGORIES} categorias.`;
  const seen = new Set<string>();
  for (const c of r.categories) {
    const label = c.label.trim();
    if (label.length < 2) return "Cada categoria precisa de um nome com pelo menos 2 letras.";
    const norm = normalizeAnswer(label);
    if (seen.has(norm)) return `Categoria repetida: ${label}`;
    seen.add(norm);
  }
  const letters = new Set(r.letters.map((l) => l.toUpperCase()).filter((l) => ALPHABET.includes(l)));
  if (letters.size < MIN_LETTERS) return `Deixe pelo menos ${MIN_LETTERS} letras no sorteio.`;
  if (!ROUND_TIME_OPTIONS.includes(r.roundSeconds)) return "Tempo de rodada inválido.";
  if (!ROUND_COUNT_OPTIONS.includes(r.maxRounds)) return "Número de rodadas inválido.";
  return null;
}

export const roundTimeLabel = (s: number | null) => (s == null ? "Sem limite" : `${s}s`);
export const roundCountLabel = (n: number | null) => (n == null ? "Livre" : `${n} rodadas`);

/** Seconds left in a timed round (never negative); null when the room has no time limit. */
export function secondsLeft(startedAt: string | null, roundSeconds: number | null, now: number): number | null {
  if (roundSeconds == null || !startedAt) return null;
  const end = new Date(startedAt).getTime() + roundSeconds * 1000;
  return Math.max(0, Math.ceil((end - now) / 1000));
}

/** Round number inside the current game (rounds before game_start_round belong to earlier games). */
export const gameRound = (room: { round_number: number; game_start_round: number }) =>
  room.round_number - room.game_start_round;

/** True when the room's round limit has been reached — no more rounds can start. */
export const roundsDone = (room: { round_number: number; game_start_round: number; max_rounds: number | null }) =>
  room.max_rounds != null && gameRound(room) >= room.max_rounds;

// ---------- Local player session (no account needed) ----------

export interface PlayerSession {
  playerId: string;
  secret: string;
  roomId: string;
}

const NAME_KEY = "stop:name";
const sessionKey = (code: string) => `stop:session:${code.toUpperCase()}`;

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  window.localStorage.setItem(NAME_KEY, name.trim());
}

export function getSession(code: string): PlayerSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(sessionKey(code));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayerSession;
  } catch {
    return null;
  }
}

export function saveSession(code: string, session: PlayerSession) {
  window.localStorage.setItem(sessionKey(code), JSON.stringify(session));
}

export function clearSession(code: string) {
  window.localStorage.removeItem(sessionKey(code));
}

export function normalizeCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
}

export function errorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) return String((err as { message: string }).message);
  return "Algo deu errado. Tente novamente.";
}

// ---------- Public invite links ----------

/** Official published address. Invites never point at the private editor preview. */
export const PUBLIC_APP_URL = "https://category-captain-club.lovable.app";

/** Hosts that need a Lovable login (editor preview) or only exist on this machine. */
export function isPrivateHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.startsWith("127.") ||
    /^(id-)?preview--/.test(hostname) ||
    hostname.endsWith(".lovableproject.com") ||
    hostname.endsWith(".lovableproject-dev.com")
  );
}

/** Origin to use in invites: the current site when it is public, otherwise the published app. */
export function publicOrigin(hostname: string, origin: string): string {
  return isPrivateHost(hostname) ? PUBLIC_APP_URL : origin;
}

export function roomInviteUrl(code: string, hostname?: string, origin?: string): string {
  const host = hostname ?? (typeof window === "undefined" ? "" : window.location.hostname);
  const org = origin ?? (typeof window === "undefined" ? PUBLIC_APP_URL : window.location.origin);
  const base = host ? publicOrigin(host, org) : PUBLIC_APP_URL;
  return `${base.replace(/\/$/, "")}/sala/${normalizeCode(code)}`;
}

export function inviteMessage(code: string, url: string): string {
  return [
    "🛑 *STOP – Desafio das Letras* 🔤",
    "",
    "Bora jogar comigo? Vem pra minha sala! 🎉",
    "",
    `🔑 Código da sala: *${normalizeCode(code)}*`,
    `👉 Entre direto pelo link: ${url}`,
    "",
    "É só digitar seu nome — sem cadastro e sem login.",
  ].join("\n");
}

export const isValidCodeFormat = (code: string) => /^[A-Z0-9]{5}$/.test(code);

const MEDALS = ["🥇", "🥈", "🥉"];

export function resultMessage(code: string, ranking: { name: string; score: number }[], url: string): string {
  const lines = ranking.map((p, i) => `${MEDALS[i] ?? `${i + 1}º`} ${p.name} — ${p.score} pts`);
  return [
    "🏆 *STOP – Desafio das Letras*",
    `Resultado da sala *${normalizeCode(code)}*:`,
    "",
    ...lines,
    "",
    `Jogue com a gente: ${url}`,
  ].join("\n");
}
