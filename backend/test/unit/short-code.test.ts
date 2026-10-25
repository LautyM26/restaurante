import { describe, expect, it } from "vitest";
import { SHORT_CODE_ALPHABET, generateUniqueCode } from "@/domain/short-code";

function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe("generateUniqueCode", () => {
  it("genera 4 caracteres del alfabeto", () => {
    const code = generateUniqueCode([], Math.random);
    expect(code).toHaveLength(4);
    for (const ch of code) expect(SHORT_CODE_ALPHABET).toContain(ch);
  });

  it("el alfabeto tiene 32 símbolos sin I, O, 0 ni 1", () => {
    expect(SHORT_CODE_ALPHABET).toHaveLength(32);
    expect(SHORT_CODE_ALPHABET).not.toMatch(/[IO01]/);
  });

  it("ante una colisión genera otro código", () => {
    // Primer código: 4 × índice 0 ("2222"); segundo: 4 × índice 1 ("3333").
    const random = sequence([0, 0, 0, 0, 1 / 32, 1 / 32, 1 / 32, 1 / 32]);
    expect(generateUniqueCode(["2222"], random)).toBe("3333");
  });

  it("lanza tras 20 colisiones", () => {
    expect(() => generateUniqueCode(["2222"], () => 0)).toThrow();
  });

  it("usa el intento 20 pero no el 21", () => {
    let calls = 0;
    const random = () => {
      calls++;
      return Math.floor((calls - 1) / 4) < 19 ? 0 : 1 / 32;
    };
    expect(generateUniqueCode(["2222"], random)).toBe("3333");
  });

  it("los extremos del aleatorio no se salen del alfabeto", () => {
    expect(generateUniqueCode([], () => 0)).toBe("2222");
    expect(generateUniqueCode([], () => 0.9999999999999999)).toBe("ZZZZ");
  });
});
