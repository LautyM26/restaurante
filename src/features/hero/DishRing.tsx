// Anillo 3D de platos destacados (RF4; plan §9.5, §10.2). Es decorativo: aria-hidden, sin texto y sin atrapar
// toques (D17: un blanco que se mueve y que duplica la carta no sirve para tocar). Gira a 3°/s.
//
// Rendimiento (RNF3): la fase vive en una ref y cada cuadro solo escribe `transform`, `opacity` y `visibility`
// directo en los nodos; no hay estado de React por cuadro, ni lecturas de layout, ni `filter`. El bucle se
// detiene fuera de pantalla y con movimiento reducido, y un cuadro largo (pestaña dormida) se acota a 100 ms.
// La sombra hacia los bordes es una capa oscura con `opacity` (no `filter: brightness`, que repinta por cuadro).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Dish, Menu } from '../../domain/types'
import { CATEGORY_VISUALS } from '../../ui/DishVisual'
import { useMediaQuery, useReducedMotionPreference } from '../../ui/useMediaQuery'
import { RING_PHONE, RING_WIDE, advancePhase, fillSlots, pickRingDishes, ringCardState } from './ringMath'

export function DishRing({ menu }: { menu: Menu | null }) {
  const wide = useMediaQuery('(min-width: 768px)')
  const reduced = useReducedMotionPreference()
  const config = wide ? RING_WIDE : RING_PHONE

  const slots = useMemo(() => fillSlots(pickRingDishes(menu?.dishes ?? []), config.count), [menu, config.count])
  const visualOf = useMemo(() => new Map(menu?.categories.map((c) => [c.id, c.visual])), [menu])

  const containerRef = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const shades = useRef<(HTMLDivElement | null)[]>([])
  const phase = useRef(0)
  const [inView, setInView] = useState(true)
  const hasSlots = slots.length > 0

  // Escribe la fase en los nodos. Cada cuadro toca solo transform / visibility / opacity.
  const paint = useCallback(
    (value: number) => {
      for (let i = 0; i < config.count; i++) {
        const card = cards.current[i]
        const shade = shades.current[i]
        if (!card || !shade) continue
        const state = ringCardState(i, value, config)
        card.style.transform = state.transform
        card.style.visibility = state.visible ? 'visible' : 'hidden'
        shade.style.opacity = String(state.shade)
      }
    },
    [config],
  )

  // La posición vigente se pinta antes del primer cuadro del navegador (y al cambiar de tamaño de anillo).
  useLayoutEffect(() => {
    if (hasSlots) paint(phase.current)
  }, [hasSlots, paint, slots])

  // Pausa fuera de pantalla: sin cuadros pendientes no hay trabajo.
  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver((entries) => {
      const last = entries.at(-1)
      if (last) setInView(last.isIntersecting)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasSlots])

  // El giro. Con movimiento reducido no se programa ningún cuadro: el anillo queda quieto (RF6).
  useEffect(() => {
    if (!hasSlots || reduced || !inView) return
    let frame = 0
    let previous: number | null = null
    const tick = (now: number) => {
      if (previous !== null) {
        phase.current = advancePhase(phase.current, now - previous)
        paint(phase.current)
      }
      previous = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [hasSlots, reduced, inView, paint])

  if (!hasSlots) return null

  const stage: CSSProperties = { transformStyle: 'preserve-3d' }
  return (
    <div
      ref={containerRef}
      data-testid="dish-ring"
      aria-hidden="true"
      className="pointer-events-none relative z-(--z-ring)"
      style={{ height: config.cardHeight, perspective: config.perspective }}
    >
      <div className="absolute inset-0" style={stage}>
        {slots.map((dish, index) => (
          <RingCard
            key={`${config.count}-${index}`}
            dish={dish}
            visual={visualOf.get(dish.categoryId) ?? 'main'}
            width={config.cardWidth}
            height={config.cardHeight}
            initial={ringCardState(index, phase.current, config)}
            cardRef={(node) => void (cards.current[index] = node)}
            shadeRef={(node) => void (shades.current[index] = node)}
          />
        ))}
      </div>
    </div>
  )
}

interface RingCardProps {
  dish: Dish
  visual: keyof typeof CATEGORY_VISUALS
  width: number
  height: number
  initial: ReturnType<typeof ringCardState>
  cardRef: (node: HTMLDivElement | null) => void
  shadeRef: (node: HTMLDivElement | null) => void
}

function RingCard({ dish, visual, width, height, initial, cardRef, shadeRef }: RingCardProps) {
  const { icon: Glyph, surface, tint } = CATEGORY_VISUALS[visual]
  return (
    <div
      ref={cardRef}
      data-ring-card
      data-dish-id={dish.id}
      className="absolute top-0 left-1/2 will-change-transform"
      style={{
        width,
        height,
        marginLeft: -width / 2,
        transform: initial.transform,
        visibility: initial.visible ? 'visible' : 'hidden',
      }}
    >
      <div className={`relative flex size-full items-center justify-center overflow-hidden rounded-row border border-hairline ${surface}`}>
        {dish.imageUrl ? (
          <img src={dish.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <Glyph size={Math.round(width * 0.42)} weight="duotone" className={tint} />
        )}
        <div ref={shadeRef} data-ring-shade className="absolute inset-0 bg-coal-950" style={{ opacity: initial.shade }} />
      </div>
    </div>
  )
}
