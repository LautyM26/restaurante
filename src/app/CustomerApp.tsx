// Esqueleto de la vista del cliente (plan §3): barra superior fija y una de dos pantallas según el hash.
// Las pantallas son PROVISORIAS: T6 reemplaza la carta por MenuScreen y T9 "Mis pedidos" por OrdersScreen.
// Lo definitivo de este archivo es la navegación: el scroll de la carta se conserva al ir y volver (RF32)
// y el foco acompaña cada cambio de pantalla.
import { useEffect, useLayoutEffect, useRef } from 'react'
import { TopBar } from '../features/layout/TopBar'
import { TableNotice } from '../features/menu/TableNotice'
import { useI18n } from '../i18n/I18nContext'
import { useTable } from '../state/TableContext'
import { TableBadge } from '../ui/TableBadge'
import { useHashScreen } from './useHashScreen'

// Mismos límites que el plan §9.6: celular fluido, tablet centrada en 720 px y escritorio en 1120 px.
const PAGE =
  'mx-auto w-full max-w-[720px] pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] outline-none md:pr-[max(1.5rem,env(safe-area-inset-right))] md:pl-[max(1.5rem,env(safe-area-inset-left))] lg:max-w-[1120px]'

export function CustomerApp() {
  const { t } = useI18n()
  const table = useTable()
  const menuScroll = useRef(0)
  const mainRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)

  // El scroll se lee al salir, antes de que la pantalla cambie y la página se acorte (el navegador lo recortaría).
  const { screen, navigate, goBackToMenu } = useHashScreen({
    onLeave: (from) => {
      if (from === 'menu') menuScroll.current = window.scrollY
    },
  })

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
      <TopBar onOpenOrders={() => navigate('orders')} ordersOpen={screen === 'orders'} />
      <main ref={mainRef} tabIndex={-1} className={PAGE}>
        {screen === 'menu' ? (
          <div className="flex flex-col items-start gap-4">
            {table.status === 'valid' && <TableBadge tableId={table.tableId} />}
            <div className="w-full">
              <TableNotice />
            </div>
            {/* Ancla de la carta: T6 monta aquí las categorías y los platos */}
            <section id="carta" className="w-full scroll-mt-24" />
          </div>
        ) : (
          <section className="flex flex-col items-start gap-5">
            <h1
              ref={titleRef}
              tabIndex={-1}
              className="font-display text-[clamp(2rem,9vw,2.75rem)] leading-[0.9] font-extrabold tracking-[-0.005em] text-bone-50 uppercase outline-none"
            >
              {t('orders.title')}
            </h1>
            <button
              type="button"
              onClick={goBackToMenu}
              className="inline-flex min-h-11 items-center rounded-full border border-ember-400/50 px-4 text-[0.9375rem] font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              {t('orders.more')}
            </button>
          </section>
        )}
      </main>
    </>
  )
}
