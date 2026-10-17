// Resumen del pedido en curso (RF2, RF20-RF22, RF24-RF27, RF44, RF46; plan §3 y §5.4). Una hoja con las líneas
// editables, la nota general, el total en vivo y la acción de enviar. El estado del envío lo maneja
// `useSubmitOrder` (que vive en MenuScreen para seguir vivo aunque la hoja se cierre); aquí solo se dibuja, y cada
// resultado aparece junto a su origen (plan §5.4):
//   línea no válida o rechazada   → marcada en la propia línea, con su motivo; el envío queda apagado
//   cambió el precio              → PriceChangeNotice en lugar del botón
//   resultado desconocido         → aviso con "Reintentar" y "Editar pedido"; la edición está bloqueada
//   sin mesa válida               → el aviso de la mesa en lugar del botón (RF2)
import { useId } from 'react'
import { useBackToClose } from '../../app/useBackToClose'
import { ORDER_NOTE_MAX } from '../../config'
import { validateLine } from '../../domain/lineValidation'
import { cartTotalCents } from '../../domain/pricing'
import { isDishOrderable } from '../../domain/selection'
import type { CartLine, LineIssue, Menu } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { useCart } from '../../state/CartContext'
import { useTable } from '../../state/TableContext'
import type { SubmitOrder } from '../../state/useSubmitOrder'
import { GlowButton } from '../../ui/GlowButton'
import { Sheet, SheetBody, SheetFooter } from '../../ui/Sheet'
import { NoteField } from '../dish/NoteField'
import { TableNotice } from '../menu/TableNotice'
import { CartLineItem } from './CartLineItem'
import { focusOnMount } from './focusOnMount'
import { PriceChangeNotice } from './PriceChangeNotice'

interface CartSheetProps {
  open: boolean
  onClose: () => void
  /** La carta vigente; `null` mientras no cargó. */
  menu: Menu | null
  submit: SubmitOrder
  /** Abre la ficha de un plato (para elegir de nuevo una línea que dejó de ser válida). */
  onReopenDish: (dishId: string) => void
}

const SECONDARY_BUTTON =
  'inline-flex min-h-12 w-full items-center justify-center rounded-full border border-ember-400/50 px-4 text-base font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100'

export function CartSheet({ open, onClose, menu, submit, onReopenDish }: CartSheetProps) {
  const { t } = useI18n()
  useBackToClose(open, onClose)

  return (
    <Sheet open={open} onClose={onClose} title={t('cart.title')}>
      <CartContents menu={menu} submit={submit} onReopenDish={onReopenDish} />
    </Sheet>
  )
}

function CartContents({ menu, submit, onReopenDish }: Pick<CartSheetProps, 'menu' | 'submit' | 'onReopenDish'>) {
  const { t, formatPrice } = useI18n()
  const cart = useCart()
  const table = useTable()
  const hintId = useId()
  const { state, locked } = submit

  // Motivos por línea: lo que dice la carta vigente más lo que dijo el restaurante al rechazar el pedido.
  const rejected = state.status === 'rejected' ? state.lines : []
  const issuesOf = (line: CartLine): LineIssue[] => {
    const issues = menu ? validateLine(menu, line) : []
    for (const { lineId, reason, groupId, optionId } of rejected) {
      if (lineId === line.key && !issues.some((i) => i.reason === reason && i.optionId === optionId)) {
        issues.push({ reason, groupId, optionId })
      }
    }
    return issues
  }
  const lineIssues = cart.lines.map((line) => ({ line, issues: issuesOf(line) }))
  const hasIssues = lineIssues.some(({ issues }) => issues.length > 0)
  const tableId = table.status === 'valid' ? table.tableId : undefined
  const total = menu ? cartTotalCents(cart.lines, menu) : 0
  const canSend = menu !== null && table.status === 'valid' && cart.lines.length > 0 && !hasIssues

  const dishOf = (line: CartLine) => menu?.dishes.find((dish) => dish.id === line.dishId)
  const priceLines =
    state.status === 'priceChanged'
      ? state.changedLines.flatMap(({ lineId, oldUnitCents, newUnitCents }) => {
          const line = cart.lines.find((l) => l.key === lineId)
          const dish = line && dishOf(line)
          return dish ? [{ name: dish.name.es, oldUnitCents, newUnitCents }] : []
        })
      : []

  return (
    <>
      <SheetBody>
        {tableId !== undefined && (
          <p className="mb-2 text-[0.9375rem] font-semibold text-ash-300">{t('table.badge', { n: tableId })}</p>
        )}

        <ul className="divide-y divide-hairline">
          {lineIssues.map(({ line, issues }) => {
            const dish = dishOf(line)
            const canReopen = dish !== undefined && isDishOrderable(dish) && issues.length > 0
            return (
              <CartLineItem
                key={line.key}
                line={line}
                dish={dish}
                issues={issues}
                locked={locked}
                onQuantityChange={(quantity) => cart.setQuantity(line.key, quantity)}
                onRemove={() => cart.removeLine(line.key)}
                onReopen={canReopen ? () => onReopenDish(line.dishId) : undefined}
              />
            )
          })}
        </ul>

        <div className="mt-2 border-t border-hairline pt-4">
          {locked ? (
            cart.note && <p className="text-[0.9375rem] leading-snug break-words text-ash-300 italic">{cart.note}</p>
          ) : (
            <NoteField label="cart.note.label" max={ORDER_NOTE_MAX} value={cart.note} onChange={cart.setNote} />
          )}
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <span className="text-[1.0625rem] font-semibold text-bone-50">{t('cart.total')}</span>
          <span className="font-display text-3xl leading-none font-semibold text-bone-50 tabular-nums">{formatPrice(total)}</span>
        </div>
      </SheetBody>

      <SheetFooter>
        <SubmitArea submit={submit} canSend={canSend} hasIssues={hasIssues} total={total} priceLines={priceLines} hintId={hintId} />
      </SheetFooter>
    </>
  )
}

interface SubmitAreaProps {
  submit: SubmitOrder
  canSend: boolean
  hasIssues: boolean
  total: number
  priceLines: { name: string; oldUnitCents: number; newUnitCents: number }[]
  hintId: string
}

/** El pie de la hoja: según el estado del envío, el botón, el aviso de precio, el error o el aviso de la mesa. */
function SubmitArea({ submit, canSend, hasIssues, total, priceLines, hintId }: SubmitAreaProps) {
  const { t, formatPrice } = useI18n()
  const table = useTable()
  const { state, locked } = submit

  if (state.status === 'sending') {
    return (
      <GlowButton wide loading className="justify-center">
        {t('cart.sending')}
      </GlowButton>
    )
  }

  if (state.status === 'unresolved') {
    return (
      <div className="flex flex-col gap-3">
        <div role="alert" tabIndex={-1} ref={focusOnMount} className="flex flex-col gap-1.5 outline-none">
          {state.resolveFailed ? (
            <p className="text-[0.9375rem] leading-snug font-semibold text-chili-400">{t('cart.error.resolveFailed')}</p>
          ) : (
            state.code === 'NETWORK' && (
              <p className="text-[0.9375rem] leading-snug font-semibold text-chili-400">{t('cart.error.network')}</p>
            )
          )}
          <p className="text-[0.9375rem] leading-snug text-ash-300">{t('cart.error.unresolved')}</p>
        </div>
        <GlowButton wide onClick={() => void submit.submit()} className="justify-center">
          {t('common.retry')}
        </GlowButton>
        <button type="button" onClick={() => void submit.edit()} className={SECONDARY_BUTTON}>
          {t('cart.edit')}
        </button>
      </div>
    )
  }

  // Sin mesa válida no se envía (RF2). Con un intento pendiente rige lo de arriba: ya se envió con una mesa válida.
  if (table.status !== 'valid' && !locked) return <TableNotice />

  if (state.status === 'priceChanged') {
    return (
      <PriceChangeNotice
        oldTotalCents={state.oldTotalCents}
        newTotalCents={state.newTotalCents}
        lines={priceLines}
        onAccept={() => void submit.submit({ expectedTotalCents: state.newTotalCents })}
        onReview={submit.dismiss}
      />
    )
  }

  const message =
    state.status === 'error' && state.code === 'VALIDATION' ? t('cart.error.validation') : hasIssues ? t('cart.fixLines') : null

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <p id={hintId} role="alert" className="text-[0.9375rem] leading-snug font-semibold text-chili-400">
          {message}
        </p>
      )}
      <GlowButton
        wide
        disabled={!canSend}
        aria-describedby={message ? hintId : undefined}
        onClick={() => void submit.submit()}
        className="justify-between"
      >
        <span>{t('cart.send')}</span>
        {total > 0 && <span className="tabular-nums">{formatPrice(total)}</span>}
      </GlowButton>
    </div>
  )
}
