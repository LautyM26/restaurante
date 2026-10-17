// Una categoría de la carta (RF7): su título y la lista de sus platos. El `id` de la sección es el destino
// de las pestañas de CategoryTabs (scrollIntoView) y lo observa el scroll-spy.
import { useId } from 'react'
import type { Category, Dish } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { DishRow } from './DishRow'

/** Id del elemento DOM de una categoría: lo comparten la sección y la pestaña que apunta a ella. */
export const categorySectionId = (categoryId: string) => `category-${categoryId}`

interface MenuSectionProps {
  category: Category
  /** Los platos de esta categoría, ya ordenados. */
  dishes: readonly Dish[]
  onOpenDish: (dish: Dish) => void
}

export function MenuSection({ category, dishes, onOpenDish }: MenuSectionProps) {
  const { localize } = useI18n()
  const headingId = useId()

  return (
    <section
      id={categorySectionId(category.id)}
      aria-labelledby={headingId}
      // Al desplazarse hasta aquí el título queda justo debajo de la barra superior y de las pestañas (≈ 8,5 rem).
      className="scroll-mt-[calc(env(safe-area-inset-top)+8.5rem)] pt-6"
    >
      <h2
        id={headingId}
        className="font-display text-[clamp(2rem,9vw,2.75rem)] leading-[0.9] font-extrabold tracking-[-0.005em] text-bone-50 uppercase"
      >
        {localize(category.name)}
      </h2>
      {/* Escritorio (≥ 1024 px): dos columnas (plan §9.6) */}
      <ul className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-10">
        {dishes.map((dish) => (
          <DishRow key={dish.id} dish={dish} visual={category.visual} onOpen={onOpenDish} />
        ))}
      </ul>
    </section>
  )
}
