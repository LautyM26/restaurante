// Fila de un plato en la carta (RF7, RF13, RF34; plan §9.5). Sin caja: texto a la izquierda, la representación
// visual de 96 × 96 a la derecha y una línea hairline debajo. Toda la fila es un <button> (abre la ficha en T7).
//
// Un plato que no se puede pedir (no disponible, o con un grupo obligatorio sin opciones suficientes: P4)
// muestra "Agotado", queda deshabilitado y no abre. En lugar de bajar la opacidad de toda la fila, se
// apagan solo la imagen y el precio: así el texto conserva el contraste mínimo de 4,5:1 (plan §9.2).
//
// Nombre accesible = el nombre del plato; descripción accesible = descripción + etiquetas + precio (+ "Agotado").
import { Fragment, useId } from 'react'
import { Grains, Leaf, Pepper, Plant } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { isDishOrderable } from '../../domain/selection'
import type { CategoryVisual, DietaryTag, Dish } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import type { TranslationKey } from '../../i18n/I18nContext'
import { DishVisual } from '../../ui/DishVisual'

const TAGS: Record<DietaryTag, { icon: Icon; label: TranslationKey; tint: string }> = {
  vegetarian: { icon: Leaf, label: 'tag.vegetarian', tint: 'text-herb-400' },
  vegan: { icon: Plant, label: 'tag.vegan', tint: 'text-herb-400' },
  gluten_free: { icon: Grains, label: 'tag.gluten_free', tint: 'text-ember-400' },
  spicy: { icon: Pepper, label: 'tag.spicy', tint: 'text-chili-400' },
}

interface DishRowProps {
  dish: Dish
  /** Estilo de la representación visual: el de la categoría del plato. */
  visual: CategoryVisual
  /** Se llama solo si el plato se puede pedir. */
  onOpen: (dish: Dish) => void
}

export function DishRow({ dish, visual, onOpen }: DishRowProps) {
  const { t, localize, formatPrice } = useI18n()
  const orderable = isDishOrderable(dish)
  const ids = { name: useId(), description: useId(), tags: useId(), price: useId() }
  const describedBy = [ids.description, dish.tags.length > 0 ? ids.tags : null, ids.price].filter(Boolean).join(' ')

  return (
    <li className="border-b border-hairline">
      <button
        type="button"
        disabled={!orderable}
        onClick={() => onOpen(dish)}
        aria-labelledby={ids.name}
        aria-describedby={describedBy}
        // `before` pinta el toque (fondo suave) sin ensanchar la fila; `isolate` lo deja detrás del texto.
        className="relative isolate flex w-full min-w-0 items-start gap-4 py-4 text-left before:absolute before:inset-y-1 before:-inset-x-2 before:-z-10 before:rounded-row before:bg-white/5 before:opacity-0 before:transition-opacity before:duration-120 before:ease-out-strong active:before:opacity-100 disabled:cursor-not-allowed motion-reduce:before:transition-none"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span id={ids.name} className="text-[1.0625rem] leading-tight font-semibold break-words text-bone-50">
            {localize(dish.name)}
          </span>
          <span id={ids.description} className="line-clamp-3 text-[0.9375rem] leading-snug break-words text-ash-300">
            {localize(dish.description)}
          </span>

          {dish.tags.length > 0 && (
            <span id={ids.tags} className="flex flex-wrap gap-x-3 gap-y-1">
              {dish.tags.map((tag, index) => {
                const { icon: Glyph, label, tint } = TAGS[tag]
                return (
                  <Fragment key={tag}>
                    {/* Espacio entre etiquetas solo para el lector de pantalla ("Picante Sin TACC", no "PicanteSin TACC") */}
                    {index > 0 && ' '}
                    <span className="inline-flex items-center gap-1 text-[0.8125rem] text-ash-300">
                      <Glyph size={14} weight="bold" aria-hidden="true" className={tint} />
                      {t(label)}
                    </span>
                  </Fragment>
                )
              })}
            </span>
          )}

          <span id={ids.price} className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={`font-display text-xl leading-none font-semibold tracking-[0.01em] tabular-nums ${
                orderable ? 'text-ember-400' : 'text-ash-500'
              }`}
            >
              {formatPrice(dish.priceCents)}
            </span>
            {!orderable && (
              <span className="rounded-full border border-hairline bg-coal-800 px-2.5 py-1 text-[0.8125rem] leading-none font-semibold text-ash-300">
                {t('dish.soldOut')}
              </span>
            )}
          </span>
        </span>

        <DishVisual visual={visual} imageUrl={dish.imageUrl} unavailable={!orderable} />
      </button>
    </li>
  )
}
