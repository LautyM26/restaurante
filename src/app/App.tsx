// Raíz de la aplicación (plan §3). Arma los providers en este orden:
//   Servicios > Idioma > Movimiento > Región viva > Mesa > CustomerApp
// ?mesa= se lee de la URL una sola vez: la mesa no cambia mientras la página está abierta (cada QR es una carga).
// T7 suma CartProvider y T9 MyOrdersProvider debajo de la mesa.
import { useState } from 'react'
import { MotionConfig } from 'motion/react'
import { parseTableParam } from '../domain/table'
import { I18nProvider } from '../i18n/I18nContext'
import type { Services } from '../services/contracts'
import { createServices } from '../services'
import { ServicesProvider } from '../services/ServicesContext'
import { TableProvider } from '../state/TableContext'
import { LiveRegionProvider } from '../ui/LiveRegion'
import { CustomerApp } from './CustomerApp'

/** `services` es opcional: en producción se usa la instancia única de `createServices()`; los tests inyectan la suya. */
export function App({ services }: { services?: Services }) {
  const [appServices] = useState(() => services ?? createServices())
  const [parsedTable] = useState(() => parseTableParam(window.location.search))

  return (
    <ServicesProvider services={appServices}>
      <I18nProvider>
        {/* reducedMotion="user": con "reducir movimiento" en el sistema, Motion deja solo opacidad (plan §10.4) */}
        <MotionConfig reducedMotion="user">
          <LiveRegionProvider>
            <TableProvider parsed={parsedTable}>
              <CustomerApp />
            </TableProvider>
          </LiveRegionProvider>
        </MotionConfig>
      </I18nProvider>
    </ServicesProvider>
  )
}
