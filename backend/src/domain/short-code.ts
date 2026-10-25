import type { Random } from "@/shared/random";

/** Dígitos 2-9 y letras mayúsculas sin I ni O (R3.9). 32 símbolos. */
export const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

const CODE_LENGTH = 4;
const MAX_ATTEMPTS = 20;

function generateCode(random: Random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    // random ∈ [0, 1): floor(r * 32) es uniforme sobre los 32 símbolos.
    const index = Math.min(
      Math.floor(random() * SHORT_CODE_ALPHABET.length),
      SHORT_CODE_ALPHABET.length - 1,
    );
    code += SHORT_CODE_ALPHABET.charAt(index);
  }
  return code;
}

/**
 * Genera un código de 4 caracteres que no esté en `existing` (códigos del
 * restaurante en las últimas 24 h). Tras 20 intentos lanza (→ 500 SERVER).
 */
export function generateUniqueCode(
  existing: Iterable<string>,
  random: Random,
): string {
  const taken = new Set(existing);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateCode(random);
    if (!taken.has(code)) return code;
  }
  throw new Error(
    `Could not generate a unique short code after ${MAX_ATTEMPTS} attempts`,
  );
}
