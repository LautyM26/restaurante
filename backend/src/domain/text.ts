const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Cuenta caracteres visibles (grafemas) igual que el front (R3.4, D-086):
 * un emoji compuesto vale 1.
 */
export function countVisibleChars(text: string): number {
  return Array.from(segmenter.segment(text)).length;
}

/** Normaliza una nota: `trim`; vacía → `undefined` (D-085). */
export function normalizeNote(note: string): string | undefined {
  const trimmed = note.trim();
  return trimmed === "" ? undefined : trimmed;
}
