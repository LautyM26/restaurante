import { isDishOrderable, toggleOption, validateSelection } from '../../src/domain/selection'
import { burger, cookingGroup, extrasGroup, makeDish, makeGroup, makeOption, salad, soldOut, trapped } from '../fixtures/menu'

describe('toggleOption', () => {
  it('en un grupo único, elegir otra opción reemplaza la anterior', () => {
    const first = toggleOption(cookingGroup, {}, 'rare')
    expect(first).toEqual({ cooking: ['rare'] })
    expect(toggleOption(cookingGroup, first, 'medium')).toEqual({ cooking: ['medium'] })
  })

  it('en un grupo único, volver a tocar la elegida la deja elegida', () => {
    expect(toggleOption(cookingGroup, { cooking: ['rare'] }, 'rare')).toEqual({ cooking: ['rare'] })
  })

  it('en un grupo múltiple agrega y quita opciones', () => {
    const one = toggleOption(extrasGroup, {}, 'cheese')
    const two = toggleOption(extrasGroup, one, 'bacon')
    expect(two).toEqual({ extras: ['cheese', 'bacon'] })
    expect(toggleOption(extrasGroup, two, 'cheese')).toEqual({ extras: ['bacon'] })
  })

  it('en un grupo múltiple no supera el máximo', () => {
    const full = { extras: ['cheese', 'bacon'] }
    expect(toggleOption(extrasGroup, full, 'ketchup')).toEqual(full)
  })

  it('en un grupo múltiple con el máximo lleno todavía permite quitar una elegida', () => {
    expect(toggleOption(extrasGroup, { extras: ['cheese', 'bacon'] }, 'bacon')).toEqual({ extras: ['cheese'] })
  })

  it('al quitar la última opción elimina el grupo de la selección', () => {
    expect(toggleOption(extrasGroup, { extras: ['cheese'] }, 'cheese')).toEqual({})
  })

  it('rechaza una opción no disponible', () => {
    const selection = { cooking: ['rare'] }
    expect(toggleOption(cookingGroup, selection, 'well_done')).toBe(selection)
  })

  it('rechaza una opción que no es del grupo', () => {
    const selection = {}
    expect(toggleOption(cookingGroup, selection, 'cheese')).toBe(selection)
  })

  it('no modifica la selección recibida ni las de otros grupos', () => {
    const selection = { cooking: ['rare'], extras: ['cheese'] }
    const next = toggleOption(extrasGroup, selection, 'bacon')
    expect(selection).toEqual({ cooking: ['rare'], extras: ['cheese'] })
    expect(next).toEqual({ cooking: ['rare'], extras: ['cheese', 'bacon'] })
  })
})

describe('validateSelection', () => {
  it('un grupo obligatorio sin elegir informa cuántas faltan', () => {
    expect(validateSelection(burger, {})).toEqual([{ groupId: 'cooking', kind: 'min', missing: 1 }])
  })

  it('con el obligatorio elegido no hay errores (el opcional vacío no cuenta)', () => {
    expect(validateSelection(burger, { cooking: ['rare'] })).toEqual([])
  })

  it('un grupo múltiple con mínimo 2 y una sola elegida informa que falta 1', () => {
    const dish = makeDish('combo', {
      optionGroups: [
        makeGroup('sides', {
          type: 'multiple',
          min: 2,
          max: 3,
          options: [makeOption('a'), makeOption('b'), makeOption('c')],
        }),
      ],
    })
    expect(validateSelection(dish, { sides: ['a'] })).toEqual([{ groupId: 'sides', kind: 'min', missing: 1 }])
    expect(validateSelection(dish, {})).toEqual([{ groupId: 'sides', kind: 'min', missing: 2 }])
    expect(validateSelection(dish, { sides: ['a', 'b'] })).toEqual([])
  })

  it('informa el exceso cuando hay más opciones que el máximo (el máximo cambió)', () => {
    expect(validateSelection(burger, { cooking: ['rare'], extras: ['ketchup', 'cheese', 'bacon'] })).toEqual([
      { groupId: 'extras', kind: 'max', excess: 1 },
    ])
  })

  it('un plato sin grupos no tiene errores', () => {
    expect(validateSelection(salad, {})).toEqual([])
  })
})

describe('isDishOrderable', () => {
  it('es verdadero con el plato disponible y sus grupos satisfacibles', () => {
    expect(isDishOrderable(salad)).toBe(true)
    expect(isDishOrderable(burger)).toBe(true)
  })

  it('es falso si el plato no está disponible', () => {
    expect(isDishOrderable(soldOut)).toBe(false)
  })

  it('es falso si un grupo obligatorio no tiene opciones disponibles (P4)', () => {
    expect(isDishOrderable(trapped)).toBe(false)
  })

  it('es falso si las opciones disponibles no alcanzan el mínimo, y verdadero si justo alcanzan', () => {
    const group = (min: number) =>
      makeDish('d', {
        optionGroups: [
          makeGroup('g', {
            type: 'multiple',
            min,
            max: 3,
            options: [makeOption('a'), makeOption('b', { available: false })],
          }),
        ],
      })
    expect(isDishOrderable(group(2))).toBe(false)
    expect(isDishOrderable(group(1))).toBe(true)
  })

  it('un grupo opcional sin opciones disponibles no impide pedir el plato', () => {
    const dish = makeDish('d', {
      optionGroups: [makeGroup('g', { min: 0, options: [makeOption('a', { available: false })] })],
    })
    expect(isDishOrderable(dish)).toBe(true)
  })
})
