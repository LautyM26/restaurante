// Funciones puras de idioma (plan §8): interpolación, plurales, precio, hora y texto de la carta.
// Sin React ni diccionarios: se prueban solas y las reutiliza la Spec 002.
import type { Lang, LocalizedText } from '../domain/types'
import { RESTAURANT } from '../config'

export type MessageVars = Record<string, string | number>

const LOCALES: Record<Lang, string> = { es: 'es-AR', en: 'en-US' }

/** Código regional que usa `Intl` para cada idioma de la interfaz. */
export function localeOf(lang: Lang): string {
  return LOCALES[lang]
}

/** Reemplaza cada `{nombre}` por su valor; si falta la variable deja el marcador a la vista. */
export function interpolate(template: string, vars: MessageVars = {}): string {
  // Una sola pasada: el valor de una variable nunca se vuelve a interpretar como marcador.
  return template.replace(/\{(\w+)\}/g, (marker, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : marker,
  )
}

/** Clave plural del diccionario (`base_one` / `base_other`) según las reglas del idioma. */
export function pluralKey(base: string, count: number, lang: Lang): string {
  // El diccionario solo distingue "uno" y "otro"; otras categorías (many, few) caen en "otro".
  const category = new Intl.PluralRules(localeOf(lang)).select(count)
  return `${base}_${category === 'one' ? 'one' : 'other'}`
}

/** Importe en centavos como moneda: sin decimales si es exacto y con dos si hay centavos. */
export function formatPrice(cents: number, lang: Lang): string {
  const fractionDigits = cents % 100 === 0 ? 0 : 2
  return new Intl.NumberFormat(localeOf(lang), {
    style: 'currency',
    currency: RESTAURANT.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(cents / 100)
}

/** Hora local de una fecha ISO: 24 h en español, 12 h en inglés. Cadena vacía si la fecha es inválida. */
export function formatTime(iso: string, lang: Lang): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(localeOf(lang), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: lang === 'en' ? 'h12' : 'h23', // hourCycle evita el "24:30" que algunos motores dan con hour12: false
  }).format(date)
}

/** Texto de la carta en el idioma pedido; si falta o está en blanco, el español (RF35). */
export function localize(text: LocalizedText, lang: Lang): string {
  const translated = text[lang]
  return translated && translated.trim() !== '' ? translated : text.es
}
