// "Mis pedidos" (RF25, RF28-RF32, RF42; CL30, CL39; plan §3 y §5.5): todos los pedidos activos del dispositivo,
// de cualquier mesa, que se actualizan solos. Un pedido que llega a entregado o cancelado mientras se mira esta
// pantalla sigue a la vista hasta salir (CL39). Mientras está abierta avisa al MyOrdersProvider: así no hay
// Toast ni novedad (RF47) y al entrar se limpia la que había.
import { useEffect, useRef } from 'react'
import type { Ref } from 'react'
import { isFinal } from '../../domain/orderStatus'
import { selectVisibleOrders } from '../../domain/myOrders'
import { useI18n } from '../../i18n/I18nContext'
import { useMyOrders } from '../../state/MyOrdersContext'
import { useTable } from '../../state/TableContext'
import { GlowButton } from '../../ui/GlowButton'
import { Skeleton } from '../../ui/Skeleton'
import { TableNotice } from '../menu/TableNotice'
import { OrderCard } from './OrderCard'

interface OrdersScreenProps {
  /** Pedido recién enviado, para destacar su confirmación (RF25). */
  highlightId: string | null
  /** "Pedir algo más" / "Ver la carta". */
  onBack: () => void
  /** El título recibe el foco al llegar a la pantalla. */
  titleRef?: Ref<HTMLHeadingElement>
}

export function OrdersScreen({ highlightId, onBack, titleRef }: OrdersScreenProps) {
  const { t } = useI18n()
  const table = useTable()
  const { orders, loading, setViewingOrders } = useMyOrders()

  useEffect(() => {
    setViewingOrders(true)
    return () => setViewingOrders(false)
  }, [setViewingOrders])

  // Los pedidos que se vieron activos y luego llegaron a un final siguen a la vista mientras la pantalla esté abierta.
  const seen = useRef(new Set<string>())
  for (const order of orders) if (!isFinal(order.status)) seen.current.add(order.id)
  const visible = selectVisibleOrders(orders, seen.current)

  return (
    <section className="flex w-full flex-col items-stretch gap-5">
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="font-display text-[clamp(2rem,9vw,2.75rem)] leading-[0.9] font-extrabold tracking-[-0.005em] text-bone-50 uppercase outline-none"
      >
        {t('orders.title')}
      </h1>

      {visible.length > 0 ? (
        <>
          <div className="flex flex-col gap-4">
            {visible.map((order) => (
              <OrderCard key={order.id} order={order} highlighted={order.id === highlightId} />
            ))}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center self-start rounded-full border border-ember-400/50 px-4 text-[0.9375rem] font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t('orders.more')}
          </button>
        </>
      ) : loading ? (
        <Skeleton className="h-64 w-full rounded-row" />
      ) : (
        <div className="flex flex-col items-start gap-4">
          {/* Con mesa válida basta decir que no hay pedidos; sin ella, cómo conseguir una (CL30) */}
          {table.status === 'valid' ? (
            <p className="text-[0.9375rem] text-ash-300">{t('orders.empty')}</p>
          ) : (
            <div className="w-full">
              <TableNotice />
            </div>
          )}
          <GlowButton onClick={onBack}>{t('hero.cta')}</GlowButton>
        </div>
      )}
    </section>
  )
}
