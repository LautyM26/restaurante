// Idioma de la interfaz (RF33-RF35, plan §5.7 y §8): español por defecto, elección recordada en el
// dispositivo con almacenamiento seguro (RNF8) y <html lang> siempre sincronizado.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Lang, LocalizedText } from '../domain/types'
import { createLocalStorage } from '../services/storage'
import { en } from './en'
import { es } from './es'
import type { MessageKey } from './es'
import { formatPrice, formatTime, interpolate, localize, pluralKey } from './format'
import type { MessageVars } from './format'

/** Clave bajo la cual se recuerda el idioma elegido. */
export const LANG_STORAGE_KEY = 'restaurante.lang'

type PluralBase = MessageKey extends infer K ? (K extends `${infer Base}_other` ? Base : never) : never
/** Claves que acepta `t()`: las simples y la base de cada plural (`dish.required` → `_one` / `_other`). */
export type TranslationKey = Exclude<MessageKey, `${string}_one` | `${string}_other`> | PluralBase

const dictionaries: Record<Lang, Record<string, string>> = { es, en }

/** Traduce una clave; con una variable numérica `count` elige la forma plural si la clave la tiene. */
function translate(lang: Lang, key: TranslationKey, vars?: MessageVars): string {
  const dictionary = dictionaries[lang]
  const count = vars?.count
  const resolved = typeof count === 'number' && `${key}_other` in dictionary ? pluralKey(key, count, lang) : key
  return interpolate(dictionary[resolved] ?? es[resolved as MessageKey] ?? key, vars)
}

function isLang(value: string | null): value is Lang {
  return value === 'es' || value === 'en'
}

export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Texto de la interfaz en el idioma actual. */
  t: (key: TranslationKey, vars?: MessageVars) => string
  /** Importe en centavos como moneda del idioma actual. */
  formatPrice: (cents: number) => string
  /** Hora local de una fecha ISO en el formato del idioma actual. */
  formatTime: (iso: string) => string
  /** Texto de la carta en el idioma actual, con respaldo en español. */
  localize: (text: LocalizedText) => string
}

const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  // localStorage seguro (RNF8), creado una sola vez por provider.
  const [store] = useState(createLocalStorage)
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = store.get(LANG_STORAGE_KEY)
    return isLang(saved) ? saved : 'es'
  })

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const value = useMemo<I18n>(
    () => ({
      lang,
      setLang: (next) => {
        setLangState(next)
        store.set(LANG_STORAGE_KEY, next)
      },
      t: (key, vars) => translate(lang, key, vars),
      formatPrice: (cents) => formatPrice(cents, lang),
      formatTime: (iso) => formatTime(iso, lang),
      localize: (text) => localize(text, lang),
    }),
    [lang, store],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18n {
  const i18n = useContext(I18nContext)
  if (!i18n) throw new Error('useI18n debe usarse dentro de <I18nProvider>')
  return i18n
}
