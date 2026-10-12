import { validateLine } from '../../src/domain/lineValidation'
import type { CartLine, Menu } from '../../src/domain/types'
import { burger, cookingGroup, menu } from '../fixtures/menu'

function line(dishId: string, selection: CartLine['selection']): CartLine {
  return { key: 'k', dishId, selection, quantity: 1, note: '' }
}

describe('validateLine', () => {
  it('una línea válida no tiene motivos', () => {
    expect(validateLine(menu, line('burger', { cooking: ['rare'], extras: ['cheese'] }))).toEqual([])
    expect(validateLine(menu, line('salad', {}))).toEqual([])
  })

  it('dish_not_found: el plato ya no está en la carta', () => {
    expect(validateLine(menu, line('ghost', {}))).toEqual([{ reason: 'dish_not_found' }])
  })

  it('dish_unavailable: el plato está agotado', () => {
    expect(validateLine(menu, line('sold_out', {}))).toEqual([{ reason: 'dish_unavailable' }])
  })

  it('dish_unavailable: un grupo obligatorio quedó sin opciones disponibles (P4)', () => {
    expect(validateLine(menu, line('trapped', {}))).toEqual([{ reason: 'dish_unavailable' }])
  })

  it('option_not_found: la opción ya no existe en el grupo', () => {
    expect(validateLine(menu, line('burger', { cooking: ['rare'], extras: ['guacamole'] }))).toEqual([
      { reason: 'option_not_found', groupId: 'extras', optionId: 'guacamole' },
    ])
  })

  it('option_not_found: el grupo ya no existe en el plato', () => {
    expect(validateLine(menu, line('burger', { cooking: ['rare'], sauce: ['bbq'] }))).toEqual([
      { reason: 'option_not_found', groupId: 'sauce', optionId: 'bbq' },
    ])
  })

  it('option_unavailable: la opción elegida dejó de estar disponible', () => {
    expect(validateLine(menu, line('burger', { cooking: ['well_done'] }))).toEqual([
      { reason: 'option_unavailable', groupId: 'cooking', optionId: 'well_done' },
    ])
  })

  it('selection_invalid: el grupo obligatorio quedó sin elegir', () => {
    expect(validateLine(menu, line('burger', {}))).toEqual([{ reason: 'selection_invalid', groupId: 'cooking' }])
  })

  it('selection_invalid: el mínimo subió y la línea guardada ya no lo alcanza', () => {
    const raisedMin: Menu = {
      ...menu,
      dishes: menu.dishes.map((d) =>
        d.id === 'burger'
          ? {
              ...burger,
              optionGroups: [
                { ...cookingGroup, type: 'multiple', min: 2, max: 2, options: cookingGroup.options.map((o) => ({ ...o, available: true })) },
                ...burger.optionGroups.slice(1),
              ],
            }
          : d,
      ),
    }
    expect(validateLine(raisedMin, line('burger', { cooking: ['rare'] }))).toEqual([
      { reason: 'selection_invalid', groupId: 'cooking' },
    ])
  })

  it('selection_invalid: el máximo bajó y la línea guardada lo supera', () => {
    expect(
      validateLine(menu, line('burger', { cooking: ['rare'], extras: ['ketchup', 'cheese', 'bacon'] })),
    ).toEqual([{ reason: 'selection_invalid', groupId: 'extras' }])
  })

  it('informa todos los motivos juntos', () => {
    expect(validateLine(menu, line('burger', { extras: ['guacamole'] }))).toEqual([
      { reason: 'option_not_found', groupId: 'extras', optionId: 'guacamole' },
      { reason: 'selection_invalid', groupId: 'cooking' },
    ])
  })
})
