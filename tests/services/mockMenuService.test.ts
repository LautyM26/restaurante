import { afterEach, describe, expect, it, vi } from 'vitest'
import { sortMenu } from '../../src/domain/menuOrder'
import { isDishOrderable } from '../../src/domain/selection'
import type { Dish } from '../../src/domain/types'
import { createSafeStorage } from '../../src/services/storage'
import { createMockMenuService, MOCK_TABLE_COUNT } from '../../src/services/mock/mockMenuService'
import { createMemoryStorage, createThrowingStorage } from '../fixtures/storage'

const setup = (backing: Storage = createMemoryStorage(), latencyMs = 0) =>
  createMockMenuService({ storage: createSafeStorage(() => backing), latencyMs })

afterEach(() => vi.useRealTimers())

describe('getMenu: carta de demostración', () => {
  it('trae 6 categorías con su orden y platos en español e inglés', async () => {
    const menu = await setup().getMenu()

    expect(menu.categories).toHaveLength(6)
    expect(new Set(menu.categories.map((c) => c.visual))).toEqual(
      new Set(['starter', 'main', 'grill', 'pasta', 'dessert', 'drink']),
    )
    expect(menu.dishes.length).toBeGreaterThanOrEqual(18)
    for (const dish of menu.dishes) {
      expect(dish.name.en, `${dish.id} sin nombre en inglés`).toBeTruthy()
      expect(dish.description.en, `${dish.id} sin descripción en inglés`).toBeTruthy()
    }
  })

  it('tiene ids únicos y grupos de opciones coherentes (min ≤ max, único ⇒ max 1)', async () => {
    const { dishes, categories } = await setup().getMenu()
    expect(new Set(dishes.map((d) => d.id)).size).toBe(dishes.length)
    expect(new Set(categories.map((c) => c.id)).size).toBe(categories.length)
    for (const dish of dishes) {
      expect(Number.isInteger(dish.priceCents) && dish.priceCents > 0).toBe(true)
      for (const group of dish.optionGroups) {
        expect(group.min, `${dish.id}/${group.id}`).toBeLessThanOrEqual(group.max)
        expect(group.max, `${dish.id}/${group.id}`).toBeLessThanOrEqual(group.options.length)
        if (group.type === 'single') expect(group.max).toBe(1)
        expect(new Set(group.options.map((o) => o.id)).size).toBe(group.options.length)
      }
    }
  })

  it('incluye los casos límite: agotado, opción no disponible, obligatorio sin opciones (P4) y categoría huérfana (CL36)', async () => {
    const { dishes, categories } = await setup().getMenu()

    expect(dishes.some((d) => !d.available)).toBe(true)
    expect(dishes.some((d) => d.available && d.optionGroups.some((g) => g.options.some((o) => !o.available)) && isDishOrderable(d))).toBe(true)
    expect(dishes.some((d) => d.available && !isDishOrderable(d))).toBe(true)
    const categoryIds = new Set(categories.map((c) => c.id))
    const orphans = dishes.filter((d) => !categoryIds.has(d.categoryId))
    expect(orphans).toHaveLength(1)
    // la interfaz la descarta con sortMenu
    expect(sortMenu({ categories, dishes }).dishes.map((d) => d.id)).not.toContain(orphans[0].id)
  })

  it('tiene suficientes destacados pedibles para el anillo de la portada', async () => {
    const { dishes } = await setup().getMenu()
    expect(dishes.filter((d) => d.featured && isDishOrderable(d)).length).toBeGreaterThanOrEqual(6)
  })

  it('devuelve una copia: modificarla no altera la carta siguiente', async () => {
    const service = setup()
    const first = await service.getMenu()
    first.dishes[0].priceCents = 1
    first.dishes.pop()
    const second = await service.getMenu()
    expect(second.dishes[0].priceCents).not.toBe(1)
    expect(second.dishes.length).toBe(first.dishes.length + 1)
  })
})

describe('getTable', () => {
  it('existe para las mesas 1 a 20', async () => {
    const service = setup()
    expect(MOCK_TABLE_COUNT).toBe(20)
    expect(await service.getTable(12)).toEqual({ id: 12 })
    expect(await service.getTable(1)).toEqual({ id: 1 })
    expect(await service.getTable(20)).toEqual({ id: 20 })
  })

  it('es null para mesas inexistentes o inválidas', async () => {
    const service = setup()
    for (const id of [0, 21, 999, -3, 12.5, Number.NaN]) {
      expect(await service.getTable(id), String(id)).toBeNull()
    }
  })
})

describe('ayudas de demo sobre la carta (setPrice, setAvailable)', () => {
  const find = async (service: ReturnType<typeof setup>, id: string): Promise<Dish> => {
    const dish = (await service.getMenu()).dishes.find((d) => d.id === id)
    if (!dish) throw new Error(`falta el plato ${id}`)
    return dish
  }

  it('setPrice cambia el precio y setAvailable la disponibilidad, sin tocar el resto', async () => {
    const service = setup()
    const before = await find(service, 'bife-chorizo')
    const otherBefore = await find(service, 'flan')

    service.setPrice('bife-chorizo', 999900)
    service.setAvailable('flan', false)

    expect((await find(service, 'bife-chorizo')).priceCents).toBe(999900)
    expect((await find(service, 'bife-chorizo')).available).toBe(before.available)
    expect((await find(service, 'flan')).available).toBe(false)
    expect((await find(service, 'flan')).priceCents).toBe(otherBefore.priceCents)
  })

  it('un plato agotado puede volver a estar disponible', async () => {
    const service = setup()
    service.setAvailable('flan', false)
    service.setAvailable('flan', true)
    expect((await find(service, 'flan')).available).toBe(true)
  })

  it('los cambios llegan a otra instancia con el mismo almacenamiento (otra pestaña)', async () => {
    const backing = createMemoryStorage()
    const tabA = setup(backing)
    const tabB = setup(backing)
    tabA.setPrice('flan', 123400)
    expect((await find(tabB, 'flan')).priceCents).toBe(123400)
  })

  it('resetOverrides deja la carta original', async () => {
    const service = setup()
    const original = await find(service, 'flan')
    service.setPrice('flan', 1)
    service.setAvailable('flan', false)
    service.resetOverrides()
    expect(await find(service, 'flan')).toEqual(original)
  })

  it('rechaza un plato inexistente, un precio inválido y no lanza con el almacenamiento bloqueado', async () => {
    const service = setup()
    expect(() => service.setPrice('no-existe', 100)).toThrow(/no-existe/)
    expect(() => service.setAvailable('no-existe', true)).toThrow(/no-existe/)
    expect(() => service.setPrice('flan', -5)).toThrow()
    expect(() => service.setPrice('flan', 10.5)).toThrow()

    const blocked = setup(createThrowingStorage())
    expect(() => blocked.setPrice('flan', 555500)).not.toThrow()
    expect((await find(blocked, 'flan')).priceCents).toBe(555500)
  })

  it('ignora un contenido corrupto en el almacenamiento', async () => {
    const backing = createMemoryStorage({ 'restaurante.mock.menuOverrides': '{no es json' })
    const menu = await setup(backing).getMenu()
    expect(menu.dishes.length).toBeGreaterThan(0)
  })
})

describe('latencia simulada', () => {
  it('getMenu y getTable no resuelven hasta cumplirse la latencia', async () => {
    vi.useFakeTimers()
    const service = setup(createMemoryStorage(), 400)

    let menuDone = false
    let tableDone = false
    const menuPromise = service.getMenu().then((m) => ((menuDone = true), m))
    const tablePromise = service.getTable(3).then((t) => ((tableDone = true), t))

    await vi.advanceTimersByTimeAsync(399)
    expect(menuDone).toBe(false)
    expect(tableDone).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect((await menuPromise).categories).toHaveLength(6)
    expect(await tablePromise).toEqual({ id: 3 })
  })
})
