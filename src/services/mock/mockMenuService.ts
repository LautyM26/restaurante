// MenuService simulado (plan §7.2). La carta base vive en menuData.ts; setPrice / setAvailable (ayudas de
// demo) guardan sus cambios en el almacenamiento, así que todas las pestañas ven la misma carta.
import type { Menu } from '../../domain/types'
import type { MenuService } from '../contracts'
import type { SafeStorage } from '../storage'
import { wait } from './latency'
import { baseMenu } from './menuData'

/** Cantidad de mesas del restaurante de demostración (mesas 1 a 20). */
export const MOCK_TABLE_COUNT = 20
/** Clave donde se guardan los cambios de precio y disponibilidad. */
export const MENU_OVERRIDES_KEY = 'restaurante.mock.menuOverrides'

interface MenuOverrides {
  prices: Record<string, number>
  available: Record<string, boolean>
}

export interface MockMenuService extends MenuService {
  setPrice(dishId: string, priceCents: number): void
  setAvailable(dishId: string, available: boolean): void
  /** Vuelve a la carta original. */
  resetOverrides(): void
}

export interface MockMenuServiceDeps {
  storage: SafeStorage
  latencyMs: number
}

export function createMockMenuService({ storage, latencyMs }: MockMenuServiceDeps): MockMenuService {
  // Se relee en cada operación: otra pestaña pudo haber cambiado la carta.
  const readOverrides = (): MenuOverrides => {
    try {
      const parsed = JSON.parse(storage.get(MENU_OVERRIDES_KEY) ?? 'null')
      return { prices: parsed?.prices ?? {}, available: parsed?.available ?? {} }
    } catch {
      return { prices: {}, available: {} }
    }
  }

  const assertDish = (dishId: string) => {
    if (!baseMenu.dishes.some((d) => d.id === dishId)) throw new Error(`No existe el plato "${dishId}"`)
  }

  return {
    async getMenu(): Promise<Menu> {
      await wait(latencyMs)
      const { prices, available } = readOverrides()
      const menu = structuredClone(baseMenu)
      for (const dish of menu.dishes) {
        dish.priceCents = prices[dish.id] ?? dish.priceCents
        dish.available = available[dish.id] ?? dish.available
      }
      return menu
    },

    async getTable(tableId) {
      await wait(latencyMs)
      const exists = Number.isInteger(tableId) && tableId >= 1 && tableId <= MOCK_TABLE_COUNT
      return exists ? { id: tableId } : null
    },

    setPrice(dishId, priceCents) {
      assertDish(dishId)
      if (!Number.isInteger(priceCents) || priceCents < 0) throw new Error('El precio debe ser un entero de centavos >= 0')
      const overrides = readOverrides()
      overrides.prices[dishId] = priceCents
      storage.set(MENU_OVERRIDES_KEY, JSON.stringify(overrides))
    },

    setAvailable(dishId, available) {
      assertDish(dishId)
      const overrides = readOverrides()
      overrides.available[dishId] = available
      storage.set(MENU_OVERRIDES_KEY, JSON.stringify(overrides))
    },

    resetOverrides() {
      storage.remove(MENU_OVERRIDES_KEY)
    },
  }
}
