// Ficha del plato (RF2, RF14-RF20, RF34, RF43; plan §3 y §5.3). Una hoja con la descripción, las
// etiquetas, los grupos de opciones, la cantidad (1 a 20) y una nota para la cocina. "Agregar" suma la línea
// al pedido en curso, cierra la ficha y anuncia el agregado (y el tope de 20, si se alcanzó).
//
// Sin mesa válida (RF2, RF3, RF41) la ficha se puede leer pero no hay "Agregar": en su lugar va el aviso de la mesa.
// Con un envío sin resolver (RF26) "Agregar" queda apagado y explica por qué.
// El estado de la selección vive en `DishForm`, que sigue montado mientras la ficha está abierta: cambiar de
// idioma o refrescar la carta no la reinicia (CL19). Se vuelve a armar al abrir otro plato (`key`).
import { useId, useMemo, useState } from 'react'
import { useBackToClose } from '../../app/useBackToClose'
import { NOTE_MAX } from '../../config'
import { lineTotalCents } from '../../domain/pricing'
import { isDishOrderable, toggleOption, validateSelection } from '../../domain/selection'
import type { CategoryVisual, Dish, OptionGroup, Selection } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { useCart } from '../../state/CartContext'
import { useTable } from '../../state/TableContext'
import { DishVisual } from '../../ui/DishVisual'
import { GlowButton } from '../../ui/GlowButton'
import { useAnnounce } from '../../ui/LiveRegion'
import { QuantityStepper } from '../../ui/QuantityStepper'
import { Sheet, SheetBody, SheetFooter } from '../../ui/Sheet'
import { DishTags } from '../menu/DishTags'
import { TableNotice } from '../menu/TableNotice'
import { NoteField } from './NoteField'
import { OptionGroupField } from './OptionGroupField'

interface DishSheetProps {
  /** El plato abierto, o null con la ficha cerrada. */
  dish: Dish | null
  /** Estilo visual de la categoría del plato. */
  visual: CategoryVisual
  onClose: () => void
}

export function DishSheet({ dish, visual, onClose }: DishSheetProps) {
  const { localize } = useI18n()
  useBackToClose(dish !== null, onClose)

  // Durante la animación de salida la hoja sigue en pantalla pero `dish` ya es null: se recuerda el último.
  const [shown, setShown] = useState<{ dish: Dish; visual: CategoryVisual } | null>(null)
  if (dish && (shown?.dish !== dish || shown.visual !== visual)) setShown({ dish, visual })

  return (
    <Sheet open={dish !== null} onClose={onClose} title={shown ? localize(shown.dish.name) : ''}>
      {shown && <DishForm key={shown.dish.id} dish={shown.dish} visual={shown.visual} onDone={onClose} />}
    </Sheet>
  )
}

/** Deja solo las opciones que siguen existiendo y disponibles en la carta vigente (puede cambiar con la ficha abierta). */
function usableSelection(dish: Dish, selection: Selection): Selection {
  const usable: Selection = {}
  for (const group of dish.optionGroups) {
    const ids = (selection[group.id] ?? []).filter((id) => group.options.some((o) => o.id === id && o.available))
    if (ids.length > 0) usable[group.id] = ids
  }
  return usable
}

function DishForm({ dish, visual, onDone }: { dish: Dish; visual: CategoryVisual; onDone: () => void }) {
  const { t, localize, formatPrice } = useI18n()
  const table = useTable()
  const cart = useCart()
  const announce = useAnnounce()
  const baseId = useId()
  const lockedId = `${baseId}-locked`

  const [chosen, setChosen] = useState<Selection>({})
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')

  const selection = useMemo(() => usableSelection(dish, chosen), [dish, chosen])
  const errors = validateSelection(dish, selection)
  const orderable = isDishOrderable(dish)
  const messageId = (group: OptionGroup) => `${baseId}-${group.id}-missing`
  const missingGroups = errors.flatMap((error) => {
    const group = dish.optionGroups.find((g) => g.id === error.groupId)
    return group && error.kind === 'min' ? [{ group, missing: error.missing }] : []
  })
  const describedBy = missingGroups.map(({ group }) => messageId(group)).join(' ') || undefined

  const toggle = (group: OptionGroup, optionId: string) =>
    setChosen(
      // Tocar de nuevo la elegida en un grupo único opcional la quita; en el resto rige toggleOption.
      group.type === 'single' && group.min === 0 && selection[group.id]?.includes(optionId)
        ? Object.fromEntries(Object.entries(selection).filter(([id]) => id !== group.id))
        : toggleOption(group, selection, optionId),
    )

  const add = () => {
    const { capped } = cart.addLine({ dishId: dish.id, selection, note, quantity })
    const added = t('dish.added', { name: localize(dish.name), qty: quantity })
    announce(capped ? `${added}. ${t('cart.maxPerDish')}` : added)
    onDone()
  }

  return (
    <>
      <SheetBody>
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-base leading-snug break-words text-ash-300">{localize(dish.description)}</p>
            <DishTags tags={dish.tags} />
            <p className="font-display text-xl leading-none font-semibold tracking-[0.01em] text-ember-400 tabular-nums">
              {formatPrice(dish.priceCents)}
            </p>
          </div>
          <DishVisual visual={visual} imageUrl={dish.imageUrl} unavailable={!orderable} />
        </div>

        <div className="mt-6 flex flex-col gap-6">
          {dish.optionGroups.map((group) => (
            <OptionGroupField
              key={group.id}
              group={group}
              selected={selection[group.id] ?? []}
              onToggle={(optionId) => toggle(group, optionId)}
              messageId={messageId(group)}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <span aria-hidden="true" className="text-[1.0625rem] font-semibold text-bone-50">
            {t('qty.label')}
          </span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <div className="mt-6">
          <NoteField label="dish.note.label" max={NOTE_MAX} value={note} onChange={setNote} />
        </div>
      </SheetBody>

      <SheetFooter>
        {!orderable ? (
          <GlowButton wide disabled>
            {t('dish.soldOut')}
          </GlowButton>
        ) : table.status !== 'valid' ? (
          <TableNotice />
        ) : cart.pending ? (
          <>
            {/* Hay un envío sin resolver: el pedido no se puede modificar hasta saber si llegó (RF26) */}
            <p id={lockedId} className="mb-2 text-center text-[0.875rem] text-ash-300">
              {t('cart.locked')}
            </p>
            <GlowButton wide disabled aria-describedby={lockedId} className="justify-between">
              <span>{t('dish.add')}</span>
              <span className="tabular-nums">{formatPrice(lineTotalCents(dish, selection, quantity))}</span>
            </GlowButton>
          </>
        ) : (
          <>
            {/* Pista visual de por qué "Agregar" está apagado; el lector de pantalla la oye por aria-describedby */}
            {missingGroups.length > 0 && (
              <p aria-hidden="true" data-add-hint="" className="mb-2 text-center text-[0.875rem] text-ash-300">
                {t('dish.required', { count: missingGroups[0].missing })} · {localize(missingGroups[0].group.name)}
              </p>
            )}
            <GlowButton wide disabled={errors.length > 0} aria-describedby={describedBy} onClick={add} className="justify-between">
              <span>{t('dish.add')}</span>
              <span className="tabular-nums">{formatPrice(lineTotalCents(dish, selection, quantity))}</span>
            </GlowButton>
          </>
        )}
      </SheetFooter>
    </>
  )
}
