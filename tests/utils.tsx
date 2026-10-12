import type { ReactElement } from 'react'
import axe from 'axe-core'
import { render } from '@testing-library/react'
import { MotionConfig } from 'motion/react'

interface RenderOptions {
  /** URL (ruta + query + hash) con la que arranca el test, por ejemplo '/?mesa=12#/orders'. */
  url?: string
}

/**
 * Renderiza dentro de MotionConfig sin duración y con movimiento reducido,
 * para que las animaciones no ralenticen ni vuelvan inestables los tests.
 * T3, T4 y T5 agregan aquí servicios, idioma y mesa a medida que existan.
 */
export function renderWithProviders(ui: ReactElement, { url = '/' }: RenderOptions = {}) {
  window.history.replaceState(null, '', url)
  return render(
    <MotionConfig transition={{ duration: 0 }} reducedMotion="always">
      {ui}
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
