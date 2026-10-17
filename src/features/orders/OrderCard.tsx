// Un pedido en "Mis pedidos" (RF28-RF31, RF48; plan §3 y §9.5): código, mesa, hora, estado, línea de tiempo,
// aviso de demora y detalle con el total. `highlighted` marca el recién enviado con la confirmación (RF25).
import { WarningCircle, XCircle } from '@phosphor-icons/react'
import { isDelayed } from '../../domain/delay'
import type { Order } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { useNow } from '../../state/useNow'
import { StatusPill } from '../../ui/StatusPill'
import { OrderTimeline } from './OrderTimeline'
import { SentCheck } from './SentCheck'

/** Cada cuánto se vuelve a evaluar la demora: el aviso aparece solo, a lo sumo 30 s después del plazo. */
const DELAY_CHECK_MS = 30_000

export function OrderCard({ order, highlighted = false }: { order: Order; highlighted?: boolean }) {
  const { t, formatPrice, formatTime, localize } = useI18n()
  const now = useNow(DELAY_CHECK_MS)
  const delayed = isDelayed(order, now)

  return (
    <article
      className={`flex min-w-0 flex-col gap-4 rounded-row border bg-coal-800 p-4 ${highlighted ? 'border-herb-400/50' : 'border-hairline'}`}
    >
      {highlighted && (
        <div className="flex items-center gap-2 text-herb-400">
          <SentCheck />
          <p className="text-[0.9375rem] font-semibold">{t('orders.sent')}</p>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="font-display text-[2rem] leading-none font-extrabold tracking-wider text-bone-50 uppercase">{order.code}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[0.875rem] text-ash-300">
            <span className="font-semibold text-bone-50">{t('orders.table', { n: order.tableId })}</span>
            <span aria-hidden="true">·</span>
            <span>{t('orders.at', { time: formatTime(order.createdAt) })}</span>
          </p>
        </div>
        <StatusPill status={order.status} />
      </header>

      {delayed && (
        <p className="flex items-start gap-2.5 rounded-row border border-chili-400/40 p-3 text-[0.9375rem] leading-snug font-semibold text-chili-400">
          <WarningCircle size={20} weight="fill" aria-hidden="true" className="mt-px shrink-0" />
          {t('orders.delayed')}
        </p>
      )}

      {order.status === 'cancelled' ? (
        <p className="flex items-start gap-2.5 text-[0.9375rem] leading-snug text-chili-400">
          <XCircle size={20} weight="fill" aria-hidden="true" className="mt-px shrink-0" />
          {t('orders.cancelled')}
        </p>
      ) : (
        <OrderTimeline status={order.status} />
      )}

      <details className="group border-t border-hairline pt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-[0.9375rem] text-bone-50 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold text-ember-400 group-open:text-bone-50">{t('orders.details')}</span>
          <span className="font-semibold">
            {t('cart.total')} {formatPrice(order.totalCents)}
          </span>
        </summary>
        <ul className="flex flex-col gap-2.5 pt-1 pb-1">
          {order.items.map((item) => (
            <li key={item.lineId} className="flex items-start justify-between gap-3 text-[0.9375rem]">
              <div className="min-w-0">
                <p className="text-bone-50 [overflow-wrap:anywhere]">
                  {item.quantity} × {localize(item.name)}
                </p>
                {item.options.length > 0 && (
                  <p className="text-[0.8125rem] text-ash-300 [overflow-wrap:anywhere]">
                    {item.options.map((option) => localize(option.name)).join(', ')}
                  </p>
                )}
                {item.note && <p className="text-[0.8125rem] text-ash-300 italic [overflow-wrap:anywhere]">{item.note}</p>}
              </div>
              <span className="shrink-0 text-ash-300">{formatPrice(item.unitPriceCents * item.quantity)}</span>
            </li>
          ))}
          {order.note && <li className="text-[0.8125rem] text-ash-300 italic [overflow-wrap:anywhere]">{order.note}</li>}
        </ul>
      </details>
    </article>
  )
}
