// Pestañas de categorías (RF11, RF12; plan §9.5): una barra pegada bajo la barra superior que lleva a cada
// categoría con scrollIntoView y resalta la que está a la vista (useScrollSpy). El indicador es una sola
// pieza que viaja de una pestaña a otra (Motion `layoutId`, resorte sin rebote).
//
// No usa vidrio con desenfoque: el plan permite como máximo dos superficies con backdrop-filter a la vez
// (barra superior y CartBar, §10.4), así que va casi opaca.
import { useCallback, useEffect, useId, useRef } from 'react'
import { motion } from 'motion/react'
import type { Category } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { SPRING, prefersReducedMotion } from '../../ui/motion'
import { categorySectionId } from './MenuSection'
import { useScrollSpy } from './useScrollSpy'

/** Aire entre la barra y el inicio de la franja que observa el scroll-spy. */
const SPY_GAP_PX = 8

export function CategoryTabs({ categories }: { categories: readonly Category[] }) {
  const { t, localize } = useI18n()
  const indicatorId = useId()
  const barRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Hasta dónde llega la barra fija (su `top` pegajoso + su alto): desde ahí empieza la franja del scroll-spy.
  const getOffset = useCallback(() => {
    const bar = barRef.current
    if (!bar) return 0
    const stickyTop = parseFloat(getComputedStyle(bar).top)
    return (Number.isFinite(stickyTop) ? stickyTop : 0) + bar.getBoundingClientRect().height + SPY_GAP_PX
  }, [])

  const { activeId, select } = useScrollSpy(
    categories.map((category) => categorySectionId(category.id)),
    getOffset,
  )

  // La pestaña activa se mantiene a la vista en la lista horizontal (centrada si hace falta).
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement
    if (!list || !item || typeof list.scrollTo !== 'function') return
    list.scrollTo({
      left: item.offsetLeft - (list.clientWidth - item.offsetWidth) / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [activeId])

  const goTo = (category: Category) => {
    const id = categorySectionId(category.id)
    select(id)
    document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }

  return (
    // El contenedor no atrapa toques (la franja transparente deja pasar el desplazamiento); la lista sí.
    <div
      ref={barRef}
      data-category-bar
      className="pointer-events-none sticky top-[calc(env(safe-area-inset-top)+4.5rem)] z-(--z-tabs) pt-1 pb-2"
    >
      <nav aria-label={t('menu.categories')} className="pointer-events-auto">
        <ul
          ref={listRef}
          className="flex snap-x snap-proximity gap-1 overflow-x-auto overscroll-x-contain rounded-full border border-hairline bg-coal-900/95 p-1 shadow-[0_6px_16px_rgb(0_0_0/0.35)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {categories.map((category) => {
            const active = categorySectionId(category.id) === activeId
            return (
              <li key={category.id} className="shrink-0 snap-start">
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => goTo(category)}
                  className="relative isolate inline-flex min-h-11 items-center rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap text-ash-300 transition-[color,transform] duration-120 ease-out-strong hover:text-bone-50 active:scale-[0.97] aria-[current=true]:text-bone-50 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  {active && (
                    <motion.span
                      layoutId={indicatorId}
                      data-indicator
                      aria-hidden="true"
                      transition={SPRING.tab}
                      className="absolute inset-0 -z-10 rounded-full bg-coal-700 shadow-[inset_0_-2px_0_0_var(--color-ember-500)]"
                    />
                  )}
                  {localize(category.name)}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
