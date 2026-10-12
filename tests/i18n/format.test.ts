import { describe, expect, it } from 'vitest'
import { formatPrice, formatTime, interpolate, localeOf, localize, pluralKey } from '../../src/i18n/format'

// Intl usa espacios no separables (U+00A0, U+202F): se normalizan para comparar texto legible.
const plain = (text: string) => text.replace(/\s/g, ' ')

describe('interpolate', () => {
  it('reemplaza cada variable {nombre}', () => {
    expect(interpolate('Agregado: {name} × {qty}', { name: 'Milanesa', qty: 2 })).toBe('Agregado: Milanesa × 2')
  })

  it('reemplaza todas las apariciones de una misma variable', () => {
    expect(interpolate('{n} y {n}', { n: 7 })).toBe('7 y 7')
  })

  it('deja el marcador a la vista si falta la variable (no escribe "undefined")', () => {
    expect(interpolate('Mesa {n}', {})).toBe('Mesa {n}')
  })

  it('devuelve el texto tal cual si no hay marcadores ni variables', () => {
    expect(interpolate('Reintentar')).toBe('Reintentar')
  })

  it('no interpreta el valor de una variable como otro marcador', () => {
    expect(interpolate('{a} {b}', { a: '{b}', b: 'x' })).toBe('{b} x')
  })
})

describe('localeOf', () => {
  it('mapea cada idioma a su variante regional', () => {
    expect(localeOf('es')).toBe('es-AR')
    expect(localeOf('en')).toBe('en-US')
  })
})

describe('pluralKey', () => {
  it('usa _one para 1 y _other para el resto, en español', () => {
    expect(pluralKey('dish.required', 1, 'es')).toBe('dish.required_one')
    expect(pluralKey('dish.required', 2, 'es')).toBe('dish.required_other')
    expect(pluralKey('dish.required', 0, 'es')).toBe('dish.required_other')
  })

  it('usa _one para 1 y _other para el resto, en inglés', () => {
    expect(pluralKey('orders.active', 1, 'en')).toBe('orders.active_one')
    expect(pluralKey('orders.active', 3, 'en')).toBe('orders.active_other')
  })

  it('manda a _other las categorías que el diccionario no distingue (many en español)', () => {
    expect(pluralKey('orders.active', 1_000_000, 'es')).toBe('orders.active_other')
  })
})

describe('formatPrice', () => {
  it('formatea pesos argentinos en español sin decimales cuando son exactos', () => {
    expect(plain(formatPrice(1_250_000, 'es'))).toBe('$ 12.500')
  })

  it('formatea ARS en inglés con el separador de miles de en-US', () => {
    expect(plain(formatPrice(1_250_000, 'en'))).toBe('ARS 12,500')
  })

  it('muestra siempre dos decimales cuando hay centavos (nunca "12.500,5")', () => {
    expect(plain(formatPrice(1_250_050, 'es'))).toBe('$ 12.500,50')
    expect(plain(formatPrice(1_250_050, 'en'))).toBe('ARS 12,500.50')
  })

  it('formatea cero y montos menores a un peso', () => {
    expect(plain(formatPrice(0, 'es'))).toBe('$ 0')
    expect(plain(formatPrice(99, 'es'))).toBe('$ 0,99')
  })

  it('formatea millones', () => {
    expect(plain(formatPrice(100_000_000, 'es'))).toBe('$ 1.000.000')
  })
})

describe('formatTime', () => {
  // Fecha armada con componentes locales: el resultado no depende de la zona horaria de la máquina.
  const at = (hour: number, minute: number) => new Date(2026, 9, 12, hour, minute).toISOString()

  it('formatea en 24 horas en español', () => {
    expect(formatTime(at(14, 5), 'es')).toBe('14:05')
    expect(formatTime(at(0, 30), 'es')).toBe('00:30')
  })

  it('formatea en 12 horas en inglés', () => {
    expect(plain(formatTime(at(14, 5), 'en'))).toBe('02:05 PM')
    expect(plain(formatTime(at(0, 30), 'en'))).toBe('12:30 AM')
  })

  it('devuelve cadena vacía ante una fecha inválida en lugar de romper', () => {
    expect(formatTime('no-es-una-fecha', 'es')).toBe('')
  })
})

describe('localize', () => {
  it('devuelve el texto del idioma pedido', () => {
    expect(localize({ es: 'Milanesa', en: 'Breaded cutlet' }, 'en')).toBe('Breaded cutlet')
    expect(localize({ es: 'Milanesa', en: 'Breaded cutlet' }, 'es')).toBe('Milanesa')
  })

  it('cae al español si falta la traducción al inglés (RF35, CL20)', () => {
    expect(localize({ es: 'Milanesa' }, 'en')).toBe('Milanesa')
  })

  it('trata una traducción vacía o en blanco como faltante', () => {
    expect(localize({ es: 'Milanesa', en: '' }, 'en')).toBe('Milanesa')
    expect(localize({ es: 'Milanesa', en: '   ' }, 'en')).toBe('Milanesa')
  })
})
