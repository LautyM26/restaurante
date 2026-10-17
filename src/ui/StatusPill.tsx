// Estado del pedido como píldora: ícono + texto (plan §9.5). El significado nunca depende solo del color
// (verde = listo, rojo = cancelado); el texto va siempre.
import { BellRinging, CheckCircle, CookingPot, ForkKnife, PaperPlaneTilt, XCircle } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { OrderStatus } from '../domain/types'
import { useI18n } from '../i18n/I18nContext'

export const STATUS_ICON: Record<OrderStatus, Icon> = {
  pending: PaperPlaneTilt,
  accepted: CheckCircle,
  preparing: CookingPot,
  ready: BellRinging,
  delivered: ForkKnife,
  cancelled: XCircle,
}

/** Color del estado: "listo" en verde, "cancelado" en rojo, el resto en brasa/hueso. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  pending: 'text-bone-50',
  accepted: 'text-bone-50',
  preparing: 'text-ember-400',
  ready: 'text-herb-400',
  delivered: 'text-ash-300',
  cancelled: 'text-chili-400',
}

export function StatusPill({ status, className = '' }: { status: OrderStatus; className?: string }) {
  const { t } = useI18n()
  const Glyph = STATUS_ICON[status]
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border border-hairline bg-coal-700 py-1 pr-3 pl-2 text-[0.8125rem] font-semibold ${STATUS_TONE[status]} ${className}`.trim()}
    >
      <Glyph size={16} weight="fill" aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 truncate">{t(`status.${status}`)}</span>
    </span>
  )
}
