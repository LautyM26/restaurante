// Inyección de los servicios (RNF4): las pantallas piden `useServices()` y nunca saben si detrás hay
// el mock o el servidor real. `services/index.ts` es el único lugar que elige la implementación.
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { Services } from './contracts'

const ServicesContext = createContext<Services | null>(null)

export function ServicesProvider({ services, children }: { services: Services; children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}

export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices debe usarse dentro de <ServicesProvider>')
  return services
}
