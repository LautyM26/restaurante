// Tokens de movimiento para Motion (plan §10.1). Tienen un espejo en `@theme` de styles/index.css
// (--ease-*) para las transiciones de CSS: si se cambia uno, se cambia el otro (lo verifica un test).
type Bezier = [number, number, number, number]

/** Curvas de easing como arreglos de Motion (x1, y1, x2, y2). */
export const EASE: Record<'expo' | 'soft' | 'outStrong' | 'drawer', Bezier> = {
  /** Entradas de la portada. */
  expo: [0.16, 1, 0.3, 1],
  /** Elementos secundarios de la entrada. */
  soft: [0.22, 0.61, 0.36, 1],
  /** UI general. */
  outStrong: [0.23, 1, 0.32, 1],
  /** Entrada de las hojas. */
  drawer: [0.32, 0.72, 0, 1],
}

/** Resortes: sin rebote en los indicadores y apenas un poco al soltar una hoja. */
export const SPRING = {
  /** Indicador de la categoría activa. */
  tab: { type: 'spring', bounce: 0, duration: 0.35 },
  /** Soltar una hoja tras un gesto con impulso. */
  sheetRelease: { type: 'spring', bounce: 0.15, duration: 0.4 },
} as const

/**
 * ¿El sistema pide reducir el movimiento? Se lee en cada llamada porque el cliente puede cambiarlo con la
 * app abierta. Sirve para lo que no pasa por Motion, como el `behavior` de `scrollIntoView` (plan §10.4).
 */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
