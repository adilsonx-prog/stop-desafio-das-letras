export type CategoryKey =
  | "nome"
  | "animal"
  | "cep"
  | "cor"
  | "comida"
  | "objeto"
  | "profissao"
  | "marca"
  | "filme";

export interface Category {
  key: CategoryKey;
  label: string;
  hint: string;
  emoji: string;
  /** Tailwind color token suffix (cat-1..cat-9) */
  color: string;
}

// Must stay in sync with public.stop_categories() in the database.
export const CATEGORIES: Category[] = [
  { key: "nome", label: "Nome", hint: "Nome de pessoa", emoji: "🙋", color: "cat-1" },
  { key: "animal", label: "Animal", hint: "Qualquer bicho", emoji: "🐾", color: "cat-2" },
  { key: "cep", label: "CEP", hint: "Cidade, Estado ou País", emoji: "🗺️", color: "cat-3" },
  { key: "cor", label: "Cor", hint: "Uma cor", emoji: "🎨", color: "cat-4" },
  { key: "comida", label: "Fruta / Comida", hint: "Algo de comer", emoji: "🍉", color: "cat-5" },
  { key: "objeto", label: "Objeto", hint: "Uma coisa", emoji: "🧸", color: "cat-6" },
  { key: "profissao", label: "Profissão", hint: "Um trabalho", emoji: "👷", color: "cat-7" },
  { key: "marca", label: "Marca", hint: "Marca famosa", emoji: "🏷️", color: "cat-8" },
  { key: "filme", label: "Filme / Série", hint: "Título de filme ou série", emoji: "🎬", color: "cat-9" },
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
