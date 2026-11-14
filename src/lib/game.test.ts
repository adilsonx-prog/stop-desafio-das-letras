import { describe, expect, it } from "vitest";
import { allFilled, emptyAnswers, isValidAnswer, normalizeCode } from "./game";

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

describe("allFilled", () => {
  it("requires all 9 categories to call STOP", () => {
    const a = emptyAnswers();
    expect(allFilled(a)).toBe(false);
    for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = "x";
    expect(allFilled(a)).toBe(true);
    expect(Object.keys(a)).toHaveLength(9);
  });
});

describe("normalizeCode", () => {
  it("uppercases and keeps at most 5 characters", () => {
    expect(normalizeCode("ab-c12x9")).toBe("ABC12");
  });
});
