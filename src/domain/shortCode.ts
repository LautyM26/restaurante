// Código corto de pedido (RF36, spec §3.3, CL34).

/** Dígitos del 2 al 9 y letras mayúsculas sin I ni O: sin caracteres ambiguos. */
export const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 4
const MAX_ATTEMPTS = 20

/** Genera un código de 4 caracteres; `random` devuelve un número en [0, 1). */
export function generateShortCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += SHORT_CODE_ALPHABET[Math.floor(random() * SHORT_CODE_ALPHABET.length)]
  }
  return code
}

/** Genera un código que no esté en `existing` (los de las últimas 24 h); falla tras 20 intentos. */
export function generateUniqueCode(existing: Iterable<string>, random: () => number = Math.random): string {
  const taken = new Set(existing)
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = generateShortCode(random)
    if (!taken.has(code)) return code
  }
  throw new Error(`No se pudo generar un código único tras ${MAX_ATTEMPTS} intentos`)
}
