import type { ReactElement } from 'react'
import axe from 'axe-core'
import { render } from '@testing-library/react'
import { MotionConfig } from 'motion/react'
import { parseTableParam } from '../src/domain/table'
import { I18nProvider } from '../src/i18n/I18nContext'
import type { Services } from '../src/services/contracts'
import { ServicesProvider } from '../src/services/ServicesContext'
import { TableCartProvider } from '../src/state/CartContext'
import { MyOrdersProvider } from '../src/state/MyOrdersContext'
import type { MyOrdersStore } from '../src/state/myOrdersStore'
import { TableProvider } from '../src/state/TableContext'
import { LiveRegionProvider } from '../src/ui/LiveRegion'

interface RenderOptions {
  /** URL (ruta + query + hash) con la que arranca el test, por ejemplo '/?mesa=12#/orders'. */
  url?: string
  /** Servicios que reciben las pantallas por useServices(); sin ellos no se monta el provider. */
  services?: Services
  /** Monta el I18nProvider (español por defecto, o el idioma guardado en localStorage). */
  i18n?: boolean
  /** Monta el TableProvider leyendo `?mesa=` de `url`; necesita `services` (verifica la mesa con getTable). */
  table?: boolean
  /** Monta el LiveRegionProvider (anuncios para lector de pantalla). */
  liveRegion?: boolean
  /** Monta el pedido en curso de la mesa (TableCartProvider); necesita `table`. */
  cart?: boolean
  /** Monta el MyOrdersProvider (pedidos del dispositivo); necesita `services`, `table` y `liveRegion`. */
  myOrders?: boolean
  /** Registro de pedidos del dispositivo para el MyOrdersProvider; por defecto el de la aplicación (localStorage). */
  myOrdersStore?: MyOrdersStore
}

/**
 * Renderiza dentro de MotionConfig sin duración y con movimiento reducido,
 * para que las animaciones no ralenticen ni vuelvan inestables los tests.
 * Los providers son opcionales y se anidan como en App: Services > I18n > Región viva > Table > MyOrders > Cart.
 */
export function renderWithProviders(ui: ReactElement, { url = '/', services, i18n = false, table = false, liveRegion = false, cart = false, myOrders = false, myOrdersStore }: RenderOptions = {}) {
  window.history.replaceState(null, '', url)
  let content = ui
  if (cart) content = <TableCartProvider>{content}</TableCartProvider>
  if (myOrders) content = <MyOrdersProvider store={myOrdersStore}>{content}</MyOrdersProvider>
  if (table) content = <TableProvider parsed={parseTableParam(window.location.search)}>{content}</TableProvider>
  if (liveRegion) content = <LiveRegionProvider>{content}</LiveRegionProvider>
  if (i18n) content = <I18nProvider>{content}</I18nProvider>
  if (services) content = <ServicesProvider services={services}>{content}</ServicesProvider>
  return render(
    <MotionConfig transition={{ duration: 0 }} reducedMotion="always">
      {content}
    </MotionConfig>,
  )
}

/**
 * Falla si axe-core encuentra violaciones de accesibilidad dentro de `container`.
 * `color-contrast` va desactivada: jsdom no calcula estilos; el contraste se
 * garantiza con la tabla de contraste por superficie del plan (§9.2).
 */
export async function expectNoA11yViolations(container: Element) {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  // Se compara contra un texto para que el mensaje de error liste cada violación.
  expect(violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`).join('; ')).toBe('')
}
