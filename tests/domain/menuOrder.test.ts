import { sortMenu } from '../../src/domain/menuOrder'
import type { Menu } from '../../src/domain/types'
import { makeDish, menu } from '../fixtures/menu'

describe('sortMenu', () => {
  it('ordena categorías y platos por `order`', () => {
    const sorted = sortMenu(menu)
    expect(sorted.categories.map((c) => c.id)).toEqual(['starters', 'mains'])
    const mainsIds = sorted.dishes.filter((d) => d.categoryId === 'mains').map((d) => d.id)
    expect(mainsIds).toEqual(['a_first', 'burger', 'b_second', 'sold_out', 'trapped'])
  })

  it('descarta el plato cuya categoría no existe', () => {
    expect(sortMenu(menu).dishes.map((d) => d.id)).not.toContain('orphan')
  })

  it('quita las categorías sin platos', () => {
    expect(sortMenu(menu).categories.map((c) => c.id)).not.toContain('empty')
  })

  it('una categoría cuyos únicos platos pertenecen a otra categoría inexistente queda vacía y se quita', () => {
    const input: Menu = {
      categories: [{ id: 'c1', name: { es: 'C1' }, order: 1, visual: 'main' }],
      dishes: [makeDish('x', { categoryId: 'c2' })],
    }
    expect(sortMenu(input)).toEqual({ categories: [], dishes: [] })
  })

  it('una carta vacía queda vacía', () => {
    expect(sortMenu({ categories: [], dishes: [] })).toEqual({ categories: [], dishes: [] })
  })

  it('no modifica la carta recibida', () => {
    const before = JSON.stringify(menu)
    sortMenu(menu)
    expect(JSON.stringify(menu)).toBe(before)
  })
})
