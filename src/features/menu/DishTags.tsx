// Etiquetas dietarias de un plato (RF7): ícono de Phosphor + texto, nunca solo color. Las comparten la fila
// de la carta y la ficha del plato.
import { Fragment } from 'react'
import { Grains, Leaf, Pepper, Plant } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { DietaryTag } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import type { TranslationKey } from '../../i18n/I18nContext'

const TAGS: Record<DietaryTag, { icon: Icon; label: TranslationKey; tint: string }> = {
  vegetarian: { icon: Leaf, label: 'tag.vegetarian', tint: 'text-herb-400' },
  vegan: { icon: Plant, label: 'tag.vegan', tint: 'text-herb-400' },
  gluten_free: { icon: Grains, label: 'tag.gluten_free', tint: 'text-ember-400' },
  spicy: { icon: Pepper, label: 'tag.spicy', tint: 'text-chili-400' },
}

export function DishTags({ tags, id }: { tags: readonly DietaryTag[]; id?: string }) {
  const { t } = useI18n()
  if (tags.length === 0) return null

  return (
    <span id={id} className="flex flex-wrap gap-x-3 gap-y-1">
      {tags.map((tag, index) => {
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
  )
}
