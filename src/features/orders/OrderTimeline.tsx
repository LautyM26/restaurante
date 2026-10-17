// Línea de tiempo vertical del pedido (RF29; plan §9.5): cinco pasos del flujo normal. Pasos hechos en hueso,
// el actual en brasa con un pulso (verde si está listo para servir) y los futuros apagados. El pedido cancelado
// no usa esta línea. El pulso es CSS (fuera del hilo principal) y se apaga con movimiento reducido.
import { ORDER_FLOW, isFinal, stepIndex } from '../../domain/orderStatus'
import type { OrderStatus } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'

type StepState = 'done' | 'current' | 'todo'

const TEXT: Record<StepState, string> = {
  done: 'text-ash-300',
  current: 'font-semibold text-bone-50',
  todo: 'text-ash-500',
}

/** Color del punto: el paso actual es brasa, verde si está listo; "Entregado" ya terminó y no se destaca. */
function dotColor(state: StepState, status: OrderStatus): string {
  if (state === 'todo') return 'bg-coal-700'
  if (state === 'done') return 'bg-bone-50'
  if (status === 'ready') return 'bg-herb-400'
  return isFinal(status) ? 'bg-bone-50' : 'bg-ember-500'
}

export function OrderTimeline({ status }: { status: OrderStatus }) {
  const { t } = useI18n()
  const currentIndex = stepIndex(status)
  const pulsing = !isFinal(status)

  return (
    <ol aria-label={t('orders.timeline')} className="flex flex-col">
      {ORDER_FLOW.map((step, index) => {
        const state: StepState = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo'
        const last = index === ORDER_FLOW.length - 1
        const dot = dotColor(state, status)
        return (
          <li
            key={step}
            data-step={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`relative min-h-7 pl-6 text-[0.9375rem] leading-snug ${TEXT[state]} ${last ? '' : 'pb-2'}`}
          >
            {/* Tramo que une este punto con el siguiente */}
            {!last && (
              <span
                aria-hidden="true"
                className={`absolute top-3.5 bottom-[-0.125rem] left-[5px] w-px ${index < currentIndex ? 'bg-bone-50/60' : 'bg-coal-700'}`}
              />
            )}
            <span aria-hidden="true" className={`absolute top-1.5 left-0 size-[11px] rounded-full ${dot}`} />
            {state === 'current' && pulsing && (
              <span aria-hidden="true" className={`absolute top-1.5 left-0 size-[11px] rounded-full motion-safe:animate-ping ${dot}`} />
            )}
            {t(`status.${step}`)}
          </li>
        )
      })}
    </ol>
  )
}
