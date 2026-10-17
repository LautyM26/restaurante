import { describe, expect, it } from 'vitest'
import { makeDish } from '../../fixtures/menu'
import {
  RING_DEG_PER_SECOND,
  RING_PHONE,
  RING_WIDE,
  advancePhase,
  fillSlots,
  normalizeAngle,
  normalizePhase,
  pickRingDishes,
  projectedX,
  ringCardState,
} from '../../../src/features/hero/ringMath'

// x, z y giro de un `translate3d(Xpx, 0px, Zpx) rotateY(Adeg)`
function parse(transform: string) {
  const m = /^translate3d\((-?[\d.]+)px, 0px, (-?[\d.]+)px\) rotateY\((-?[\d.]+)deg\)$/.exec(transform)
  if (!m) throw new Error(`transform inesperado: ${transform}`)
  return { x: Number(m[1]), z: Number(m[2]), rotate: Number(m[3]) }
}
const visibleCount = (phase: number, config = RING_PHONE) =>
  Array.from({ length: config.count }, (_, i) => ringCardState(i, phase, config)).filter((c) => c.visible).length

describe('ringMath: ángulos y fase', () => {
  it.each([
    [0, 0],
    [190, -170],
    [-190, 170],
    [180, -180],
    [-180, -180],
    [540, -180],
    [360, 0],
    [-359, 1],
  ])('normalizeAngle(%d) = %d (rango [-180, 180))', (input, expected) => {
    expect(normalizeAngle(input)).toBe(expected)
  })

  it.each([
    [0, 0],
    [370, 10],
    [-10, 350],
    [720, 0],
  ])('normalizePhase(%d) = %d (rango [0, 360))', (input, expected) => {
    expect(normalizePhase(input)).toBe(expected)
  })

  it('gira 3 grados por segundo', () => {
    expect(RING_DEG_PER_SECOND).toBe(3)
    expect(advancePhase(10, 100)).toBeCloseTo(10.3, 10)
    expect(advancePhase(0, 50)).toBeCloseTo(0.15, 10)
  })

  it('acota el salto de tiempo a 100 ms: una pestaña dormida no hace saltar el anillo', () => {
    expect(advancePhase(0, 5000)).toBeCloseTo(0.3, 10)
    expect(advancePhase(0, 1000)).toBeCloseTo(0.3, 10)
  })

  it('la fase se mantiene normalizada al dar la vuelta, y un dt negativo no retrocede', () => {
    expect(advancePhase(359.9, 100)).toBeCloseTo(0.2, 10)
    expect(advancePhase(5, -50)).toBe(5)
  })
})

describe('ringMath: estado de cada carta (plan §9.5)', () => {
  it('la carta del frente está visible, centrada, sin sombra y sin giro', () => {
    const front = ringCardState(0, 0, RING_PHONE)
    expect(front.visible).toBe(true)
    expect(front.shade).toBe(0)
    expect(parse(front.transform)).toEqual({ x: 0, z: 0, rotate: 0 })
  })

  it('una carta a 22,5° queda a R·sen(a) a un costado, adelantada R·(1−cos a) y girada hacia el centro', () => {
    const { x, z, rotate } = parse(ringCardState(1, 0, RING_PHONE).transform)
    const a = (22.5 * Math.PI) / 180
    expect(x).toBeCloseTo(RING_PHONE.radius * Math.sin(a), 2)
    expect(z).toBeCloseTo(RING_PHONE.radius * (1 - Math.cos(a)), 2)
    expect(rotate).toBe(-22.5)
  })

  it('es simétrica: ±a dan el mismo z y sombra, x y giro opuestos', () => {
    const right = ringCardState(1, 0, RING_PHONE)
    const left = ringCardState(RING_PHONE.count - 1, 0, RING_PHONE)
    const r = parse(right.transform)
    const l = parse(left.transform)
    expect(l.x).toBe(-r.x)
    expect(l.z).toBe(r.z)
    expect(l.rotate).toBe(-r.rotate)
    expect(left.shade).toBe(right.shade)
    // y con la otra configuración y otro ángulo
    const w1 = parse(ringCardState(2, 0, RING_WIDE).transform)
    const w2 = parse(ringCardState(RING_WIDE.count - 2, 0, RING_WIDE).transform)
    expect(w2.x).toBe(-w1.x)
    expect(w2.z).toBe(w1.z)
  })

  it('no emite "-0" en el texto del transform', () => {
    expect(ringCardState(0, 0, RING_PHONE).transform).not.toContain('-0px')
    expect(ringCardState(0, 0, RING_PHONE).transform).not.toContain('-0deg')
  })

  it('la sombra crece hacia los bordes: min(0,6; 1,2·(1/cos a − 1))', () => {
    const s0 = ringCardState(0, 0, RING_PHONE).shade
    const s1 = ringCardState(1, 0, RING_PHONE).shade
    const s2 = ringCardState(2, 0, RING_PHONE).shade
    expect(s0).toBeLessThan(s1)
    expect(s1).toBeLessThan(s2)
    expect(s1).toBeCloseTo(1.2 * (1 / Math.cos((22.5 * Math.PI) / 180) - 1), 3)
    expect(s2).toBeCloseTo(1.2 * (1 / Math.cos((45 * Math.PI) / 180) - 1), 3)
  })

  it('la sombra nunca pasa de 0,6', () => {
    const wideCull = { ...RING_PHONE, cull: 90 }
    // índice 3 = 67,5°: 1,2·(1/cos − 1) ≈ 2,6 sin tope
    expect(ringCardState(3, 0, wideCull).shade).toBe(0.6)
    expect(ringCardState(4, 0, wideCull).shade).toBe(0.6)
  })

  it('recorta lo que pasa de cull: 48° entra, 48,5° no', () => {
    // la carta 2 está a 45° + fase
    expect(ringCardState(2, 3, RING_PHONE).visible).toBe(true) // 48°
    expect(ringCardState(2, 3.5, RING_PHONE).visible).toBe(false) // 48,5°
    expect(ringCardState(2, -3.5, RING_PHONE).visible).toBe(true) // 41,5°
  })

  it('con la configuración de celular hay 5 cartas visibles (la del frente y dos por lado)', () => {
    expect(RING_PHONE.count).toBe(16)
    expect(RING_PHONE.cull).toBe(48)
    expect(visibleCount(0, RING_PHONE)).toBe(5)
  })

  it('con la configuración de tablet y escritorio también hay 5 visibles', () => {
    expect(RING_WIDE.count).toBe(20)
    expect(visibleCount(0, RING_WIDE)).toBe(5)
  })

  it('al girar siempre hay 4 o 5 cartas a la vista, nunca un anillo vacío', () => {
    for (let phase = 0; phase < 360; phase += 7.3) {
      const n = visibleCount(phase)
      expect(n).toBeGreaterThanOrEqual(4)
      expect(n).toBeLessThanOrEqual(5)
    }
  })

  it('la fase mueve las cartas, y una vuelta completa las deja en el mismo lugar', () => {
    expect(ringCardState(0, 0, RING_PHONE).transform).not.toBe(ringCardState(0, 10, RING_PHONE).transform)
    expect(ringCardState(3, 360, RING_PHONE).transform).toBe(ringCardState(3, 0, RING_PHONE).transform)
  })
})

describe('ringMath: encaje en pantalla (plan §9.5, criterio a 320 y 375 px)', () => {
  // Medio ancho de la carta en pantalla: más cerca de la cámara se ve más grande (P / (P − z)) y girada
  // hacia el centro se ve más angosta (cos a).
  const extent = (index: number) => {
    const a = (normalizeAngle(index * (360 / RING_PHONE.count)) * Math.PI) / 180
    const scale = RING_PHONE.perspective / (RING_PHONE.perspective - RING_PHONE.radius * (1 - Math.cos(a)))
    const x = Math.abs(projectedX(index, 0, RING_PHONE))
    const half = (RING_PHONE.cardWidth * scale * Math.cos(a)) / 2
    return { inner: x - half, outer: x + half }
  }

  it('el frente queda centrado', () => {
    expect(projectedX(0, 0, RING_PHONE)).toBe(0)
  })

  it('la proyección es simétrica', () => {
    expect(projectedX(15, 0, RING_PHONE)).toBeCloseTo(-projectedX(1, 0, RING_PHONE), 6)
  })

  it.each([320, 375])('a %d px las vecinas caben enteras y las extremas asoman cortadas por el borde', (viewport) => {
    const edge = viewport / 2
    expect(extent(1).outer).toBeLessThanOrEqual(edge)
    expect(extent(2).inner).toBeLessThan(edge)
    expect(extent(2).outer).toBeGreaterThan(edge)
  })
})

describe('ringMath: qué platos entran al anillo (plan §9.5)', () => {
  const featured = makeDish('f1', { featured: true })
  const featured2 = makeDish('f2', { featured: true })
  const plain = makeDish('p1')
  const plain2 = makeDish('p2')
  const soldOut = makeDish('s1', { featured: true, available: false })

  it('solo destacados pedibles: un destacado agotado no entra', () => {
    expect(pickRingDishes([plain, featured, soldOut, featured2]).map((d) => d.id)).toEqual(['f1', 'f2'])
  })

  it('sin destacados pedibles recurre a los primeros pedibles, en el orden de la carta', () => {
    const agotado = makeDish('x', { available: false })
    expect(pickRingDishes([agotado, plain, plain2, soldOut]).map((d) => d.id)).toEqual(['p1', 'p2'])
  })

  it('sin ningún plato pedible no hay anillo', () => {
    expect(pickRingDishes([makeDish('x', { available: false }), soldOut])).toEqual([])
    expect(pickRingDishes([])).toEqual([])
  })

  it('rellena las posiciones ciclando los platos', () => {
    expect(fillSlots([featured, featured2], 5).map((d) => d.id)).toEqual(['f1', 'f2', 'f1', 'f2', 'f1'])
    expect(fillSlots([featured], 3).map((d) => d.id)).toEqual(['f1', 'f1', 'f1'])
  })

  it('sin platos no hay posiciones', () => {
    expect(fillSlots([], 16)).toEqual([])
  })
})
