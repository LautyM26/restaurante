import { describe, expect, it } from 'vitest'
import { en } from '../../src/i18n/en'
import { es } from '../../src/i18n/es'
import type { MessageKey } from '../../src/i18n/es'

const keysOf = (dictionary: Record<string, string>) => Object.keys(dictionary).sort()
const placeholdersOf = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('diccionarios es y en', () => {
  it('en tiene exactamente las mismas claves que es', () => {
    expect(keysOf(en)).toEqual(keysOf(es))
  })

  it('ninguna traducción está vacía', () => {
    const empty = [...Object.entries(es), ...Object.entries(en)].filter(([, text]) => text.trim() === '')
    expect(empty).toEqual([])
  })

  it('cada clave usa los mismos marcadores {variable} en ambos idiomas', () => {
    const mismatched = (Object.keys(es) as MessageKey[]).filter(
      (key) => placeholdersOf(es[key]).join() !== placeholdersOf(en[key]).join(),
    )
    expect(mismatched).toEqual([])
  })

  it('cada plural tiene sus dos formas, _one y _other', () => {
    const keys = Object.keys(es)
    const bases = new Set(keys.filter((k) => /_(one|other)$/.test(k)).map((k) => k.replace(/_(one|other)$/, '')))
    expect(bases.size).toBeGreaterThan(0)
    const incomplete = [...bases].filter((b) => !keys.includes(`${b}_one`) || !keys.includes(`${b}_other`))
    expect(incomplete).toEqual([])
  })

  it('los plurales con cantidad llevan {count} en ambas formas', () => {
    for (const dictionary of [es, en]) {
      expect(dictionary['dish.required_other']).toContain('{count}')
      expect(dictionary['orders.active_other']).toContain('{count}')
    }
  })

  it('ningún texto de interfaz usa rayas largas (plan §8)', () => {
    const withDash = [...Object.entries(es), ...Object.entries(en)].filter(([, text]) => text.includes('—'))
    expect(withDash).toEqual([])
  })

  it('los textos traducidos al inglés no son copia del español en las claves de texto largo', () => {
    // Una clave larga sin traducir delata un "copiar y pegar" olvidado.
    const untranslated = (Object.keys(es) as MessageKey[]).filter((key) => es[key].length > 25 && es[key] === en[key])
    expect(untranslated).toEqual([])
  })

  it('una clave faltante rompe la compilación (verificado por tsc en npm run build)', () => {
    // @ts-expect-error falta casi todo el diccionario: `satisfies Record<MessageKey, string>` debe fallar
    const incomplete = { 'common.retry': 'Try again' } satisfies Record<MessageKey, string>
    // @ts-expect-error una clave de más tampoco está permitida
    const extra = { ...en, 'clave.inexistente': 'x' } satisfies Record<MessageKey, string>
    expect([incomplete, extra]).toHaveLength(2)
  })
})
