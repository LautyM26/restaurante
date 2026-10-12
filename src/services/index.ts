// ÚNICO punto donde se elige la implementación de los servicios (RNF4). Hoy: el mock con localStorage y
// BroadcastChannel. Con el backend real, solo cambia este archivo (más el adaptador REST + WebSocket de §7.3-§7.4).
import type { Services } from './contracts'
import { createMockMenuService } from './mock/mockMenuService'
import type { MockMenuService } from './mock/mockMenuService'
import { createMockOrderService } from './mock/mockOrderService'
import type { ChannelFactory, MockOrderService } from './mock/mockOrderService'
import { createLocalStorage } from './storage'
import type { SafeStorage } from './storage'

export interface MockConfig {
  latencyMs: number
  autoAdvance: boolean
}

export interface MockServices extends Services {
  menuService: MockMenuService
  orderService: MockOrderService
}

const DEFAULT_LATENCY_MS = 400

/** Lee `VITE_MOCK_LATENCY_MS` (entero >= 0) y `VITE_MOCK_AUTO_ADVANCE` (solo "true" lo activa). */
export function readMockConfig(env: Record<string, unknown>): MockConfig {
  const latency = env.VITE_MOCK_LATENCY_MS
  return {
    latencyMs: typeof latency === 'string' && /^\d+$/.test(latency) ? Number(latency) : DEFAULT_LATENCY_MS,
    autoAdvance: env.VITE_MOCK_AUTO_ADVANCE === 'true',
  }
}

/** Arma los servicios simulados; `storage` y `channelFactory` se pueden inyectar (tests). */
export function buildMockServices(
  config: MockConfig,
  deps: { storage?: SafeStorage; channelFactory?: ChannelFactory } = {},
): MockServices {
  const storage = deps.storage ?? createLocalStorage()
  const menuService = createMockMenuService({ storage, latencyMs: config.latencyMs })
  // El pedido consulta la carta por dentro: con una carta sin latencia propia, cada llamada espera una sola vez.
  const instantMenu = createMockMenuService({ storage, latencyMs: 0 })
  const orderService = createMockOrderService({
    storage,
    latencyMs: config.latencyMs,
    autoAdvance: config.autoAdvance,
    menuService: instantMenu,
    ...(deps.channelFactory ? { channelFactory: deps.channelFactory } : {}),
  })
  return { menuService, orderService }
}

let instance: MockServices | undefined

/**
 * Servicios de la aplicación. Una sola instancia por página: `main.tsx` (ayudas de demo) y la interfaz
 * deben compartirla para que los avisos locales y los temporizadores sean los mismos.
 */
export function createServices(): MockServices {
  instance ??= buildMockServices(readMockConfig(import.meta.env))
  return instance
}
