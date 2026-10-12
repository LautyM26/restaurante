// Conteo y recorte de texto por caracteres visibles (RF20): un emoji compuesto cuenta como 1.

/** Divide el texto en caracteres visibles (grafemas); sin Intl.Segmenter, en puntos de código. */
function visibleChars(text: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment)
  }
  return [...text]
}

export function countVisibleChars(text: string): number {
  return visibleChars(text).length
}

/** Corta el texto en `max` caracteres visibles sin partir ninguno por la mitad. */
export function limitVisibleChars(text: string, max: number): string {
  return visibleChars(text).slice(0, max).join('')
}
