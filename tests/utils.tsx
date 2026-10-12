import type { ReactElement } from 'react'
import axe from 'axe-core'
import { render } from '@testing-library/react'
import { MotionConfig } from 'motion/react'
import { parseTableParam } from '../src/domain/table'
import { I18nProvider } from '../src/i18n/I18nContext'
import type { Services } from '../src/services/contracts'
import { ServicesProvider } from '../src/services/ServicesContext'
import { TableProvider } from '../src/state/TableContext'

interface RenderOptions {
  /** URL (ruta + query + hash) con la que arranca el test, por ejemplo '/?mesa=12#/orders'. */
  url?: string
  /** Servicios que reciben las pantallas por useServices(); sin ellos no se monta el provider. */
  services?: Services
  /** Monta el I18nProvider (español por defecto, o el idioma guardado en localStorage). */
  i18n?: boolean
  /** Monta el TableProvider leyendo `?mesa=` de `url`; necesita `services` (verifica la mesa con getTable). */
  table?: boolean
}

/**
 * Renderiza dentro de MotionConfig sin duración y con movimiento reducido,
 * para que las animaciones no ralenticen ni vuelvan inestables los tests.
 * Los providers son opcionales y se anidan como en App: Services > I18n > Table.
 */
export function renderWithProviders(ui: ReactElement, { url = '/', services, i18n = false, table = false }: RenderOptions = {}) {
  window.history.replaceState(null, '', url)
  let content = ui
  if (table) content = <TableProvider parsed={parseTableParam(window.location.search)}>{content}</TableProvider>
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
