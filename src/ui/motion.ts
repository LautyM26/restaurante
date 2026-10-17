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

// ── Entrada animada de la portada (RF5; plan §10.3) ─────────────────────────────────────────────────────────
/** Duración máxima de toda la secuencia de entrada, en milisegundos (RF5). */
export const INTRO_MS = 1800

export type IntroKey =
  | 'topBar'
  | 'brand'
  | 'language'
  | 'orders'
  | 'badge'
  | 'titleLine1'
  | 'titleLine2'
  | 'subtitle'
  | 'cta'
  | 'ring'
  | 'panel'

interface IntroStep {
  /** Desplazamiento vertical de partida, en px de escritorio (en celular se multiplica por 0,66). */
  y: number
  /** Escala de partida, si la tiene. */
  scale?: number
  /**
   * Revela el elemento con un `clip-path` que sube (renglones del titular). El plan usa `inset(100% 0 -30% 0)`; aquí
   * los costados llevan -50% para que el resplandor del titular (text-shadow de 34 px) no quede cortado en recto.
   */
  clip?: boolean
  /** Segundos. */
  duration: number
  delay: number
  ease: 'expo' | 'soft'
}

/** La tabla del plan §10.3, en segundos. El panel termina a los 1,8 s (900 ms de demora + 900 ms). */
export const INTRO_STEPS: Record<IntroKey, IntroStep> = {
  topBar: { y: -9, duration: 0.62, delay: 0.06, ease: 'expo' },
  brand: { y: 6, duration: 0.52, delay: 0.15, ease: 'soft' },
  language: { y: 6, duration: 0.52, delay: 0.185, ease: 'soft' },
  orders: { y: 6, duration: 0.52, delay: 0.215, ease: 'soft' },
  badge: { y: 11, scale: 0.985, duration: 0.56, delay: 0.27, ease: 'expo' },
  titleLine1: { y: 15, clip: true, duration: 0.9, delay: 0.38, ease: 'expo' },
  titleLine2: { y: 15, clip: true, duration: 0.9, delay: 0.47, ease: 'expo' },
  subtitle: { y: 10, duration: 0.62, delay: 0.69, ease: 'expo' },
  cta: { y: 13, scale: 0.985, duration: 0.62, delay: 0.83, ease: 'expo' },
  ring: { y: 18, scale: 0.99, duration: 0.95, delay: 0.7, ease: 'expo' },
  panel: { y: 26, duration: 0.9, delay: 0.9, ease: 'expo' },
}

type IntroTarget = Record<string, string | number>
export interface IntroProps {
  initial: false | IntroTarget
  animate?: IntroTarget
  transition?: { duration: number; delay: number; ease: Bezier }
}

/** Factor de las distancias en celular (< 768 px). */
const COMPACT_FACTOR = 0.66

/**
 * Props de Motion para un elemento de la entrada. Solo `opacity` y `transform` (más `clip-path` en el
 * titular), y `transform` como cadena completa para que no la pise el atajo `y`/`scale` (plan §10.2).
 * Sin reproducir la entrada devuelve solo `initial: false`: el elemento nace en su sitio, sin estilos en línea.
 */
export function introProps(play: boolean, key: IntroKey, compact = false): IntroProps {
  if (!play) return { initial: false }
  const step = INTRO_STEPS[key]
  const y = +(step.y * (compact ? COMPACT_FACTOR : 1)).toFixed(2)
  const scaleFrom = step.scale === undefined ? '' : ` scale(${step.scale})`
  const scaleTo = step.scale === undefined ? '' : ' scale(1)'
  return {
    initial: {
      opacity: 0,
      transform: `translateY(${y}px)${scaleFrom}`,
      ...(step.clip && { clipPath: 'inset(100% -50% -30% -50%)' }),
    },
    animate: {
      opacity: 1,
      transform: `translateY(0px)${scaleTo}`,
      ...(step.clip && { clipPath: 'inset(-30% -50% -30% -50%)' }),
    },
    transition: { duration: step.duration, delay: step.delay, ease: EASE[step.ease] },
  }
}
