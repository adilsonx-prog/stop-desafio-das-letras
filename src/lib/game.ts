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
  key: CategoryKey;
  label: string;
  hint: string;
  emoji: string;
  /** Tailwind color token suffix (cat-1..cat-13) */
  color: string;
  /** Gets the fun highlighted card. */
  featured?: boolean;
}

// Must stay in sync with public.stop_categories() in the database.
export const CATEGORIES: Category[] = [
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

export type Answers = Record<CategoryKey, string>;

export const emptyAnswers = (): Answers =>
  Object.fromEntries(CATEGORIES.map((c) => [c.key, ""])) as Answers;

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

export function allFilled(answers: Answers): boolean {
  return CATEGORIES.every((c) => answers[c.key]?.trim().length > 0);
}

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
export const PUBLIC_APP_URL = "__PUBLIC_URL__";

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

/** Mirrors public.stop_votes_needed(): a majority of the *other* players annuls an answer. */
export function votesNeeded(playerCount: number): number {
  return Math.max(1, Math.floor((Math.max(playerCount, 1) - 1) / 2) + 1);
}

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
