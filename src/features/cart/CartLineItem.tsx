// Una línea del resumen del pedido (RF20, RF22, RF27, RF44; plan §3). Muestra el plato con sus opciones y su nota,
// el importe de la línea y la cantidad editable (en 1, el mismo botón es "Quitar"). Si la línea ya no es válida
// frente a la carta vigente, la marca con el motivo, en la propia línea, y ofrece volver a elegirla si el plato
// todavía se puede pedir. Con el pedido bloqueado (envío sin resolver, RF26) la cantidad es solo texto.
import { WarningCircle } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { lineTotalCents } from '../../domain/pricing'
import type { CartLine, Dish, LineIssue } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { QuantityStepper } from '../../ui/QuantityStepper'
import { EASE } from '../../ui/motion'

interface CartLineItemProps {
  line: CartLine
  /** El plato en la carta vigente; `undefined` si ya no está. */
  dish: Dish | undefined
  /** Por qué la línea no es válida; vacío si se puede enviar. */
  issues: LineIssue[]
  /** El pedido no se puede modificar. */
  locked: boolean
  onQuantityChange: (quantity: number) => void
  onRemove: () => void
  /** Reabre la ficha del plato para elegir de nuevo; solo si el plato todavía se puede pedir. */
  onReopen?: () => void
}

export function CartLineItem({ line, dish, issues, locked, onQuantityChange, onRemove, onReopen }: CartLineItemProps) {
  const { t, localize, formatPrice } = useI18n()
  const name = dish ? localize(dish.name) : t('cart.line.unknownDish')
  const reasons = [...new Set(issues.map((issue) => issue.reason))]

  // Opciones elegidas en el orden de los grupos; la que causó el problema se tacha.
  const options = (dish?.optionGroups ?? []).flatMap((group) =>
    (line.selection[group.id] ?? []).flatMap((optionId) => {
      const option = group.options.find((o) => o.id === optionId)
      const flagged = issues.some((issue) => issue.groupId === group.id && issue.optionId === optionId)
      return option ? [{ id: `${group.id}:${optionId}`, label: localize(option.name), flagged }] : []
    }),
  )

  return (
    <li data-invalid={reasons.length > 0 || undefined} className="flex flex-col gap-2.5 py-4 first:pt-1">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-[1.0625rem] leading-tight font-semibold break-words text-bone-50">{name}</p>
        {dish && (
          <p className="shrink-0 font-display text-xl leading-none font-semibold tracking-[0.01em] text-ember-400 tabular-nums">
            {formatPrice(lineTotalCents(dish, line.selection, line.quantity))}
          </p>
        )}
      </div>

      {options.length > 0 && (
        <p className="text-[0.9375rem] leading-snug break-words text-ash-300">
          {options.map((option, index) => (
            <span key={option.id} className={option.flagged ? 'text-chili-400 line-through' : undefined}>
              {index > 0 && ', '}
              {option.label}
            </span>
          ))}
        </p>
      )}
      {line.note && <p className="text-[0.9375rem] leading-snug break-words text-ash-300 italic">{line.note}</p>}

      {reasons.map((reason) => (
        <motion.p
          key={reason}
          initial={{ opacity: 0, transform: 'translateY(-4px)' }}
          animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.18, ease: EASE.outStrong } }}
          className="flex items-start gap-2 text-[0.9375rem] leading-snug text-chili-400"
        >
          <WarningCircle size={20} weight="fill" aria-hidden="true" className="mt-px shrink-0" />
          <span>{t(`cart.line.${reason}`)}</span>
        </motion.p>
      ))}

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        {locked ? (
          <p className="font-display text-2xl leading-none font-semibold text-bone-50 tabular-nums">× {line.quantity}</p>
        ) : (
          <QuantityStepper
            value={line.quantity}
            onChange={onQuantityChange}
            onRemove={onRemove}
            label={`${t('qty.label')}: ${name}`}
          />
        )}
        {!locked && onReopen && (
          <button
            type="button"
            onClick={onReopen}
            aria-label={t('cart.line.reopenLabel', { name })}
            className="inline-flex min-h-11 items-center rounded-full border border-ember-400/50 px-4 text-[0.9375rem] font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t('cart.line.reopen')}
          </button>
        )}
      </div>
    </li>
  )
}
