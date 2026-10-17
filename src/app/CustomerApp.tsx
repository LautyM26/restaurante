// Vista del cliente (plan §3): barra superior fija, el Toast de novedades y una de dos pantallas según el hash.
// La carta se pide aquí, una sola vez, y sobrevive a ir y volver de "Mis pedidos" (y se refresca al volver a
// primer plano). La navegación: el scroll de la carta se conserva al ir y volver (RF32) y el foco acompaña
// cada cambio de pantalla. Un cambio de estado de un pedido estando en la carta muestra el Toast (RF47).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { TopBar } from '../features/layout/TopBar'
import { useIntroOnce } from '../features/hero/useIntroOnce'
import { MenuScreen } from '../features/menu/MenuScreen'
import { OrdersScreen } from '../features/orders/OrdersScreen'
import type { Order } from '../domain/types'
import { useI18n } from '../i18n/I18nContext'
import { useMyOrders } from '../state/MyOrdersContext'
import { useMenu } from '../state/useMenu'
import { STATUS_ICON } from '../ui/StatusPill'
import { Toast } from '../ui/Toast'
import { useHashScreen } from './useHashScreen'

// Mismos límites que el plan §9.6: celular fluido, tablet centrada en 720 px y escritorio en 1120 px.
const PAGE =
  'mx-auto w-full max-w-[720px] pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] outline-none md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] lg:max-w-[1120px]'

export function CustomerApp() {
  const { t } = useI18n()
  const menu = useMenu()
  // La entrada animada de la portada y de la barra: una vez por sesión (RF5), nunca con movimiento reducido (RF6).
  const intro = useIntroOnce()
  const myOrders = useMyOrders()
  const { register, lastChange } = myOrders
  // El pedido recién enviado, para destacar su confirmación en "Mis pedidos" (RF25).
  const [justSentId, setJustSentId] = useState<string | null>(null)
  // El último cambio de estado a avisar en la carta; el texto se arma al dibujar para seguir el idioma.
  const [toastChange, setToastChange] = useState<{ id: number; order: Order } | null>(null)
  const menuScroll = useRef(0)
  const mainRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // El scroll se lee al salir, antes de que la pantalla cambie y la página se acorte (el navegador lo recortaría).
  const { screen, navigate, goBackToMenu } = useHashScreen({
    onLeave: (from) => {
      if (from === 'menu') menuScroll.current = window.scrollY
    },
  })

  // Un pedido quedó registrado: se muestra "Mis pedidos". Si el resumen estaba abierto, su entrada de historial se
  // reemplaza (no se apila otra encima): así "Pedir algo más" y "atrás" vuelven a la carta sin pasos de más.
  const handleSent = useCallback(
    (order: Order) => {
      register(order)
      setJustSentId(order.id)
      navigate('orders', { replace: window.history.state?.sheet === true })
    },
    [navigate, register],
  )

  // Cada cambio de estado nuevo se avisa solo si se está en la carta; el que ocurre en "Mis pedidos" ya se ve ahí.
  const seenChange = useRef(lastChange?.seq ?? 0)
  useEffect(() => {
    if (!lastChange || lastChange.seq === seenChange.current) return
    seenChange.current = lastChange.seq
    if (screen === 'menu') setToastChange({ id: lastChange.seq, order: lastChange.order })
  }, [lastChange, screen])
  useEffect(() => {
    if (screen !== 'menu') setToastChange(null)
  }, [screen])
  const closeToast = useCallback(() => setToastChange(null), [])

  // La restauración automática del navegador compite con la propia: se desactiva y se hace a mano.
  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  // Cada pantalla empieza arriba, salvo la carta al volver (queda donde estaba). El foco pasa al título de
  // "Mis pedidos" o al contenido de la carta para que lector de pantalla y teclado sepan que algo cambió.
  const shown = useRef(screen)
  useLayoutEffect(() => {
    if (shown.current === screen) return // primer render (también el doble montaje de StrictMode): no se toca nada
    shown.current = screen
    window.scrollTo(0, screen === 'menu' ? menuScroll.current : 0)
    ;(screen === 'orders' ? titleRef.current : mainRef.current)?.focus({ preventScroll: true })
  }, [screen])

  return (
    <>
      <TopBar onOpenOrders={() => navigate('orders')} ordersOpen={screen === 'orders'} intro={intro} />
      <Toast
        toast={
          toastChange && {
            id: toastChange.id,
            icon: STATUS_ICON[toastChange.order.status],
            message: t('orders.announce', { code: toastChange.order.code, status: t(`status.${toastChange.order.status}`) }),
          }
        }
        actionLabel={t('toast.view')}
        closeLabel={t('toast.close')}
        onAction={() => navigate('orders')}
        onClose={closeToast}
      />
      <main ref={mainRef} tabIndex={-1} className={PAGE}>
        {screen === 'menu' ? (
          <MenuScreen menu={menu} onSent={handleSent} intro={intro} />
        ) : (
          <OrdersScreen highlightId={justSentId} onBack={goBackToMenu} titleRef={titleRef} />
        )}
      </main>
    </>
  )
}
