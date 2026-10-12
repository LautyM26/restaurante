// Servicios de prueba con la verificación de mesa controlable. El MenuService devuelve una carta vacía
// (las pantallas de T5 no la usan) y el OrderService es el falso sin transporte (RNF10).
import { vi } from 'vitest'
import type { Services } from '../../src/services/contracts'
import { createFakeOrderService } from './fakeOrderService'

type GetTable = Services['menuService']['getTable']

export interface TestServices extends Services {
  menuService: Services['menuService'] & { getTable: ReturnType<typeof vi.fn<GetTable>> }
}

/** `getTable` por defecto: cualquier mesa existe. Pasale otra para provocar null, errores o esperas. */
export function createTestServices(getTable: GetTable = async (id) => ({ id })): TestServices {
  return {
    menuService: { getMenu: async () => ({ categories: [], dishes: [] }), getTable: vi.fn<GetTable>(getTable) },
    orderService: createFakeOrderService(),
  }
}
