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
  roomInviteUrl,
  votesNeeded,
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
    a.sogra = " ";
    expect(allFilled(a)).toBe(false);
  });
});

describe("normalizeAnswer", () => {
  it("ignores case, accents and extra spaces when comparing answers", () => {
    expect(normalizeAnswer("  São   Paulo ")).toBe(normalizeAnswer("sao paulo"));
  });
});

describe("votesNeeded", () => {
  it("needs a majority of the other players to annul an answer", () => {
    expect(votesNeeded(2)).toBe(1);
    expect(votesNeeded(3)).toBe(2);
    expect(votesNeeded(4)).toBe(2);
    expect(votesNeeded(5)).toBe(3);
    expect(votesNeeded(15)).toBe(8);
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
