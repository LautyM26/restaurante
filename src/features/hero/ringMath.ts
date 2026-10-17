// Matemática pura del anillo 3D de platos (plan §9.5): dónde queda cada carta para una fase dada.
// Se mira el anillo desde adentro: la cámara está sobre el eje, así que las cartas de los costados quedan
// un poco más cerca y giradas hacia el centro. Todo se expresa con `transform` y `opacity` (D12).
//   ángulo de la carta i = normalizar(i · paso + fase), con paso = 360° / cantidad
//   posición = translate3d(R·sen a, 0, R·(1 − cos a)) rotateY(−a)
//   sombra   = min(0,6; 1,2·(1/cos a − 1))   → capa negra con `opacity`, nunca `filter` (repintado por cuadro)
import { isDishOrderable } from '../../domain/selection'
import type { Dish } from '../../domain/types'

export interface RingConfig {
  /** Cartas del anillo completo. */
  count: number
  /** Radio R, en px. */
  radius: number
  /** Distancia de la cámara, en px (la propiedad `perspective`). */
  perspective: number
  /** Ángulo máximo, en grados, a partir del cual la carta se oculta. */
  cull: number
  cardWidth: number
  cardHeight: number
}

/**
 * Celular (< 768 px). El plan fija R = perspective = 560, pero con esa geometría la vecina de la del frente
 * queda a R·tan(22,5°) ≈ 232 px del centro: fuera de una pantalla de 320-375 px, y no se ven las 5 cartas que
 * pide el criterio. Con R = 250 las vecinas caben enteras y las extremas asoman cortadas (lo verifica un test).
 */
export const RING_PHONE: RingConfig = { count: 16, radius: 250, perspective: 560, cull: 48, cardWidth: 112, cardHeight: 150 }
/** Tablet y escritorio (≥ 768 px): valores del plan. */
export const RING_WIDE: RingConfig = { count: 20, radius: 760, perspective: 760, cull: 48, cardWidth: 140, cardHeight: 186 }

/** Velocidad de giro (RF4): lenta, decorativa. */
export const RING_DEG_PER_SECOND = 3
/** Un cuadro más largo que esto (pestaña dormida, tarea larga) se trata como si hubiera durado esto. */
const MAX_FRAME_MS = 100
const MAX_SHADE = 0.6

const toRad = (deg: number) => (deg * Math.PI) / 180
/** Redondea a 3 decimales (texto corto en el `style`) y evita "-0". */
const round = (n: number) => Math.round(n * 1000) / 1000 + 0

/** Lleva un ángulo en grados al rango [-180, 180). */
export const normalizeAngle = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180
/** Lleva una fase en grados al rango [0, 360). */
export const normalizePhase = (deg: number) => ((deg % 360) + 360) % 360

/** Avanza la fase según el tiempo del cuadro (en ms). El salto se acota y nunca retrocede. */
export function advancePhase(phase: number, dtMs: number): number {
  const dt = Math.min(Math.max(dtMs, 0), MAX_FRAME_MS)
  return normalizePhase(phase + (RING_DEG_PER_SECOND * dt) / 1000)
}

export interface RingCardState {
  visible: boolean
  transform: string
  /** Opacidad de la capa oscura que apaga las cartas hacia los bordes, de 0 a 0,6. */
  shade: number
}

export function ringCardState(index: number, phase: number, config: RingConfig): RingCardState {
  const angle = normalizeAngle(index * (360 / config.count) + phase)
  const rad = toRad(angle)
  const x = config.radius * Math.sin(rad)
  const z = config.radius * (1 - Math.cos(rad))
  const shade = Math.abs(angle) >= 90 ? MAX_SHADE : Math.min(MAX_SHADE, 1.2 * (1 / Math.cos(rad) - 1))
  return {
    visible: Math.abs(angle) <= config.cull,
    transform: `translate3d(${round(x)}px, 0px, ${round(z)}px) rotateY(${round(-angle)}deg)`,
    shade: round(shade),
  }
}

/** Dónde cae el centro de la carta en pantalla, en px respecto del centro del anillo (proyección en perspectiva). */
export function projectedX(index: number, phase: number, config: RingConfig): number {
  const rad = toRad(normalizeAngle(index * (360 / config.count) + phase))
  const depth = config.perspective - config.radius * (1 - Math.cos(rad))
  return round((config.radius * Math.sin(rad) * config.perspective) / depth)
}

/**
 * Platos del anillo (plan §9.5): los destacados pedibles; si no hay, los primeros pedibles de la carta;
 * si no hay ninguno, el anillo no se muestra.
 */
export function pickRingDishes(dishes: readonly Dish[]): Dish[] {
  const orderable = dishes.filter(isDishOrderable)
  const featured = orderable.filter((dish) => dish.featured)
  return featured.length > 0 ? featured : orderable
}

/** Rellena las posiciones del anillo ciclando los platos. Sin platos no hay posiciones. */
export function fillSlots(dishes: readonly Dish[], count: number): Dish[] {
  if (dishes.length === 0) return []
  return Array.from({ length: count }, (_, i) => dishes[i % dishes.length])
}
