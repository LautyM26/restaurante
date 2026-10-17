import { SHORT_CODE_ALPHABET, generateShortCode, generateUniqueCode } from '../../src/domain/shortCode'

/** Genera una secuencia de números en [0,1) que se repite en ciclo. */
function cycle(values: number[]) {
  let i = 0
  return () => values[i++ % values.length]
}

describe('SHORT_CODE_ALPHABET', () => {
  it('son dígitos del 2 al 9 y letras mayúsculas sin I ni O (32 símbolos, sin repetidos)', () => {
    expect(SHORT_CODE_ALPHABET).toHaveLength(32)
    expect(new Set(SHORT_CODE_ALPHABET).size).toBe(32)
    expect(SHORT_CODE_ALPHABET).toMatch(/^[2-9A-HJ-NP-Z]+$/)
    for (const forbidden of ['0', '1', 'I', 'O']) expect(SHORT_CODE_ALPHABET).not.toContain(forbidden)
  })
})

describe('generateShortCode', () => {
  it('genera 4 caracteres del alfabeto con el azar por defecto', () => {
    for (let i = 0; i < 200; i++) {
      expect(generateShortCode()).toMatch(/^[2-9A-HJ-NP-Z]{4}$/)
    }
  })

  it('usa el azar inyectado: los extremos del rango dan el primer y el último símbolo', () => {
    expect(generateShortCode(() => 0)).toBe('2222')
    expect(generateShortCode(() => 0.999999)).toBe('ZZZZ')
  })

  it('cada posición consume un número', () => {
    expect(generateShortCode(cycle([0, 1 / 32, 2 / 32, 31 / 32]))).toBe('234Z')
  })
})

describe('generateUniqueCode', () => {
  it('devuelve un código que no está entre los existentes', () => {
    expect(generateUniqueCode(new Set(), () => 0)).toBe('2222')
  })

  it('evita un código existente y genera otro', () => {
    // Primer intento: 2222 (existe). Segundo intento: 3333.
    const random = cycle([0, 0, 0, 0, 1 / 32, 1 / 32, 1 / 32, 1 / 32])
    expect(generateUniqueCode(new Set(['2222']), random)).toBe('3333')
  })

  it('acepta cualquier iterable de códigos existentes', () => {
    const random = cycle([0, 0, 0, 0, 1 / 32, 1 / 32, 1 / 32, 1 / 32])
    expect(generateUniqueCode(['2222'], random)).toBe('3333')
  })

  it('falla tras 20 intentos sin encontrar un código libre', () => {
    const random = vi.fn(() => 0)
    expect(() => generateUniqueCode(new Set(['2222']), random)).toThrow(/20/)
    expect(random).toHaveBeenCalledTimes(20 * 4)
  })

  it('si el intento 20 es libre todavía lo logra', () => {
    let calls = 0
    const random = () => {
      // Cada intento consume 4 números; recién el intento 20 usa un valor distinto.
      const attempt = Math.floor(calls++ / 4)
      return attempt === 19 ? 5 / 32 : 0
    }
    expect(generateUniqueCode(new Set(['2222']), random)).toBe('7777')
  })
})
