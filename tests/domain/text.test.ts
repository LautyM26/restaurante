import { countVisibleChars, limitVisibleChars } from '../../src/domain/text'

const FAMILY = '\u{1F468}‍\u{1F469}‍\u{1F467}' // emoji compuesto: varios puntos de código unidos
const FLAG = '\u{1F1E6}\u{1F1F7}' // bandera: dos indicadores regionales

describe('countVisibleChars', () => {
  it('cuenta un emoji compuesto como 1', () => {
    expect(FAMILY.length).toBeGreaterThan(1)
    expect(countVisibleChars(FAMILY)).toBe(1)
    expect(countVisibleChars(FLAG)).toBe(1)
  })

  it('cuenta texto común y combina con emojis', () => {
    expect(countVisibleChars('')).toBe(0)
    expect(countVisibleChars('sin cebolla')).toBe(11)
    expect(countVisibleChars(`a${FAMILY}b`)).toBe(3)
  })

  it('cuenta una letra con tilde combinada como 1', () => {
    expect(countVisibleChars('é')).toBe(1)
  })

  it('sin Intl.Segmenter cuenta por puntos de código', () => {
    vi.stubGlobal('Intl', { ...Intl, Segmenter: undefined })
    try {
      expect(countVisibleChars('añb\u{1F600}')).toBe(4)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('limitVisibleChars', () => {
  it('no toca un texto que ya entra', () => {
    expect(limitVisibleChars('hola', 140)).toBe('hola')
    expect(limitVisibleChars('hola', 4)).toBe('hola')
  })

  it('corta en 140 caracteres visibles', () => {
    expect(limitVisibleChars('a'.repeat(200), 140)).toBe('a'.repeat(140))
  })

  it('no rompe un emoji compuesto en el borde del corte', () => {
    expect(limitVisibleChars(`ab${FAMILY}cd`, 3)).toBe(`ab${FAMILY}`)
    expect(limitVisibleChars(`ab${FAMILY}cd`, 2)).toBe('ab')
    expect(limitVisibleChars(`${FLAG}${FLAG}`, 1)).toBe(FLAG)
  })

  it('con máximo 0 devuelve vacío', () => {
    expect(limitVisibleChars('hola', 0)).toBe('')
  })
})
