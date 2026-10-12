// Servicios de prueba con la verificación de mesa y la carta controlables. Por defecto la carta es vacía
// (las pantallas de T5 no la usan) y el OrderService es el falso sin transporte (RNF10).
import { vi } from 'vitest'
import type { Services } from '../../src/services/contracts'
import { createFakeOrderService } from './fakeOrderService'

type GetTable = Services['menuService']['getTable']
type GetMenu = Services['menuService']['getMenu']

export interface TestServices extends Services {
  menuService: Services['menuService'] & { getTable: ReturnType<typeof vi.fn<GetTable>>; getMenu: ReturnType<typeof vi.fn<GetMenu>> }
}

/**
 * `getTable` por defecto: cualquier mesa existe. `getMenu` por defecto: carta vacía.
 * Pasales otra para provocar null, errores, esperas o una carta concreta.
 */
export function createTestServices(
  getTable: GetTable = async (id) => ({ id }),
  getMenu: GetMenu = async () => ({ categories: [], dishes: [] }),
): TestServices {
  return {
    menuService: { getMenu: vi.fn<GetMenu>(getMenu), getTable: vi.fn<GetTable>(getTable) },
    orderService: createFakeOrderService(),
  }
}
