import { describe, expect, it } from "vitest";
import {
  allFilled,
  CATEGORIES,
  emptyAnswers,
  inviteMessage,
  isPrivateHost,
  isValidAnswer,
  isValidCodeFormat,
  normalizeAnswer,
  normalizeCode,
  PUBLIC_APP_URL,
  roomCategories,
  roomInviteUrl,
  roundsDone,
  secondsLeft,
  validateRules,
  DEFAULT_LETTERS,
  type RoomRules,
} from "./game";

describe("isValidAnswer", () => {
  it("accepts answers starting with the round letter, ignoring case and accents", () => {
    expect(isValidAnswer("Ácaro", "A")).toBe(true);
    expect(isValidAnswer("  elefante ", "E")).toBe(true);
  });

  it("rejects answers with another initial", () => {
    expect(isValidAnswer("Banana", "A")).toBe(false);
  });

  it("rejects single-letter or empty answers", () => {
    expect(isValidAnswer("A", "A")).toBe(false);
    expect(isValidAnswer("", "A")).toBe(false);
  });
});

describe("categories", () => {
  it("has the 13 categories in the requested order", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      "Nome",
      "Cidade",
      "Estado ou País",
      "CEP",
      "Cor",
      "Comida",
      "Fruta",
      "Filme, Desenho ou Série",
      "Minha sogra é…",
      "Animal",
      "Objeto",
      "Profissão",
      "Marca",
    ]);
  });

  it("keeps Fruta and Comida as separate fields", () => {
    const keys = CATEGORIES.map((c) => c.key);
    expect(keys).toContain("fruta");
    expect(keys).toContain("comida");
    expect(new Set(keys).size).toBe(13);
  });
});

describe("allFilled", () => {
  it("requires all 13 categories to call STOP", () => {
    const a = emptyAnswers();
    expect(allFilled(a)).toBe(false);
    for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = "x";
    expect(allFilled(a)).toBe(true);
    a["sogra"] = " ";
    expect(allFilled(a)).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("ignores case, accents and extra spaces when comparing answers", () => {
    expect(normalizeAnswer("  São   Paulo ")).toBe(normalizeAnswer("sao paulo"));
  });
});

const rules = (over: Partial<RoomRules> = {}): RoomRules => ({
  categories: CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
  letters: DEFAULT_LETTERS,
  roundSeconds: null,
  maxRounds: null,
  ...over,
});

describe("room rules", () => {
  it("allows from 4 to 15 categories per game", () => {
    const cats = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `c_${i}`, label: `Categoria ${i}` }));
    expect(validateRules(rules({ categories: cats(3) }))).not.toBeNull();
    expect(validateRules(rules({ categories: cats(4) }))).toBeNull();
    expect(validateRules(rules({ categories: cats(15) }))).toBeNull();
    expect(validateRules(rules({ categories: cats(16) }))).not.toBeNull();
  });

  it("rejects a custom category with the same name as another", () => {
    const categories = [...rules().categories.slice(0, 4), { key: "c_x", label: "  cidáde " }];
    expect(validateRules(rules({ categories }))).toContain("repetida");
  });

  it("offers 60s, 90s, 120s or no time limit", () => {
    for (const s of [60, 90, 120, null]) expect(validateRules(rules({ roundSeconds: s }))).toBeNull();
    expect(validateRules(rules({ roundSeconds: 30 }))).not.toBeNull();
  });

  it("offers 3, 5, 10 rounds or free play", () => {
    for (const n of [3, 5, 10, null]) expect(validateRules(rules({ maxRounds: n }))).toBeNull();
    expect(validateRules(rules({ maxRounds: 7 }))).not.toBeNull();
  });

  it("leaves the hard letters K, Q, W, X, Y, Z out of the default draw", () => {
    for (const l of ["K", "Q", "W", "X", "Y", "Z"]) expect(DEFAULT_LETTERS).not.toContain(l);
  });

  it("shows custom categories after the chosen built-in ones, in order", () => {
    const cats = roomCategories([
      { key: "nome", label: "Nome" },
      { key: "c_ab12cd", label: "Time de futebol" },
    ]);
    expect(cats.map((c) => c.label)).toEqual(["Nome", "Time de futebol"]);
    expect(allFilled({ nome: "Ana", c_ab12cd: "" }, cats)).toBe(false);
    expect(allFilled({ nome: "Ana", c_ab12cd: "Atlético" }, cats)).toBe(true);
  });

  it("counts down the round time and stops at zero", () => {
    const start = "2026-01-01T00:00:00.000Z";
    const t0 = new Date(start).getTime();
    expect(secondsLeft(start, 60, t0 + 15_000)).toBe(45);
    expect(secondsLeft(start, 60, t0 + 90_000)).toBe(0);
    expect(secondsLeft(start, null, t0)).toBeNull();
  });

  it("ends the game after the chosen number of rounds", () => {
    expect(roundsDone({ round_number: 4, game_start_round: 2, max_rounds: 3 })).toBe(false);
    expect(roundsDone({ round_number: 5, game_start_round: 2, max_rounds: 3 })).toBe(true);
    expect(roundsDone({ round_number: 50, game_start_round: 0, max_rounds: null })).toBe(false);
  });
});

describe("invite links", () => {
  it("never uses the private editor preview address", () => {
    expect(isPrivateHost("id-preview--abc.lovable.app")).toBe(true);
    expect(isPrivateHost("abc.lovableproject.com")).toBe(true);
    expect(roomInviteUrl("cl3rb", "id-preview--abc.lovable.app", "https://id-preview--abc.lovable.app")).toBe(
      `${PUBLIC_APP_URL}/sala/CL3RB`,
    );
  });

  it("uses the current address when it is already the public site", () => {
    expect(roomInviteUrl("CL3RB", "stop.example.com", "https://stop.example.com")).toBe(
      "https://stop.example.com/sala/CL3RB",
    );
  });

  it("points at the published app", () => {
    expect(PUBLIC_APP_URL).toMatch(/^https:\/\/[a-z0-9-]+\.lovable\.app$/);
  });

  it("puts the game name, room code and link in the WhatsApp message", () => {
    const msg = inviteMessage("CL3RB", "https://x.lovable.app/sala/CL3RB");
    expect(msg).toContain("STOP – Desafio das Letras");
    expect(msg).toContain("CL3RB");
    expect(msg).toContain("https://x.lovable.app/sala/CL3RB");
  });

  it("accepts only 5-character room codes", () => {
    expect(isValidCodeFormat("CL3RB")).toBe(true);
    expect(isValidCodeFormat("CL3R")).toBe(false);
  });
});

describe("normalizeCode", () => {
  it("uppercases and keeps at most 5 characters", () => {
    expect(normalizeCode("ab-c12x9")).toBe("ABC12");
  });
});
