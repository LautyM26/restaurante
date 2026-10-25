import { describe, expect, it } from "vitest";
import { NOTE_MAX, ORDER_NOTE_MAX } from "@/domain/limits";
import { countVisibleChars, normalizeNote } from "@/domain/text";

const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}";
const FLAG = "\u{1F1E6}\u{1F1F7}";
const SKIN = "\u{1F44D}\u{1F3FD}";

describe("countVisibleChars", () => {
  it("cuenta emojis compuestos como 1", () => {
    expect(FAMILY.length).toBeGreaterThan(1);
    expect(countVisibleChars(FAMILY)).toBe(1);
    expect(countVisibleChars(FLAG)).toBe(1);
    expect(countVisibleChars(SKIN)).toBe(1);
  });

  it("cuenta texto común, vacío y mezclado (mismos casos que el front)", () => {
    expect(countVisibleChars("")).toBe(0);
    expect(countVisibleChars("sin cebolla")).toBe(11);
    expect(countVisibleChars(`a${FAMILY}b`)).toBe(3);
    expect(countVisibleChars("é")).toBe(1);
    expect(countVisibleChars("é")).toBe(1);
  });

  it.each([
    ["NOTE_MAX", NOTE_MAX],
    ["ORDER_NOTE_MAX", ORDER_NOTE_MAX],
  ])("borde de %s: max entra, max+1 no", (_name, max) => {
    expect(countVisibleChars("a".repeat(max)) <= max).toBe(true);
    expect(countVisibleChars("a".repeat(max + 1)) <= max).toBe(false);
    expect(countVisibleChars(FAMILY.repeat(max))).toBe(max);
    expect(countVisibleChars(FAMILY.repeat(max + 1))).toBe(max + 1);
  });

  it("los límites son 140 y 200", () => {
    expect(NOTE_MAX).toBe(140);
    expect(ORDER_NOTE_MAX).toBe(200);
  });
});

describe("normalizeNote", () => {
  it("recorta espacios en los extremos", () => {
    expect(normalizeNote("  sin sal  ")).toBe("sin sal");
    expect(normalizeNote("a  b")).toBe("a  b");
  });

  it("vacía o solo espacios → undefined", () => {
    expect(normalizeNote("")).toBeUndefined();
    expect(normalizeNote("   \t\n ")).toBeUndefined();
  });
});
