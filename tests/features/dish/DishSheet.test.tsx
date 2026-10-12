import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Menu } from '../../../src/domain/types'
import { MenuScreen } from '../../../src/features/menu/MenuScreen'
import { useI18n } from '../../../src/i18n/I18nContext'
import { formatPrice as rawFormatPrice } from '../../../src/i18n/format'
import { useCart } from '../../../src/state/CartContext'
import { useMenu } from '../../../src/state/useMenu'
import { burger, cookingGroup, extrasGroup, makeDish, makeGroup, makeOption, mains, salad, starters } from '../../fixtures/menu'
import { createTestServices } from '../../fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

// Intl separa el signo y el número con un espacio de no ruptura; se normaliza a un espacio común.
const formatPrice = (cents: number, lang: 'es' | 'en' = 'es') => rawFormatPrice(cents, lang).replace(/\s/g, ' ')

const named = (group: typeof cookingGroup, es: string, en: string) => ({ ...group, name: { es, en } })

// Plato con todo: descripción, etiquetas, grupo obligatorio con una opción agotada y extras con costo.
const milanesa = makeDish('milanesa', {
  categoryId: 'mains',
  order: 5,
  name: { es: 'Milanesa', en: 'Cutlet' },
  description: { es: 'Con jamón y mozzarella.', en: 'With ham and mozzarella.' },
  priceCents: 1000000,
  tags: ['spicy'],
  optionGroups: [
    named(cookingGroup, 'Cocción', 'Doneness'),
    named(extrasGroup, 'Extras', 'Extras'),
  ],
})
// Dos o más opciones obligatorias (min > 1).
const icecream = makeDish('icecream', {
  categoryId: 'starters',
  order: 6,
  priceCents: 500000,
  optionGroups: [
    makeGroup('flavors', {
      type: 'multiple',
      min: 2,
      max: 3,
      options: [makeOption('vanilla'), makeOption('choco'), makeOption('lemon'), makeOption('mint', { available: false })],
    }),
  ],
})
// Grupo de elección única opcional.
const coffee = makeDish('coffee', {
  categoryId: 'starters',
  order: 7,
  priceCents: 300000,
  optionGroups: [
    makeGroup('milk', { type: 'single', min: 0, max: 1, options: [makeOption('oat'), makeOption('whole')] }),
  ],
})

// Dos grupos obligatorios a la vez (uno pide 1 y el otro 2).
const combo = makeDish('combo', {
  categoryId: 'mains',
  order: 8,
  optionGroups: [
    makeGroup('base', { type: 'single', min: 1, max: 1, options: [makeOption('rice'), makeOption('fries')] }),
    makeGroup('toppings', { type: 'multiple', min: 2, max: 2, options: [makeOption('egg'), makeOption('ham'), makeOption('cheese')] }),
  ],
})

const testMenu: Menu = { categories: [starters, mains], dishes: [salad, coffee, icecream, burger, milanesa, combo] }

let cart!: ReturnType<typeof useCart>
let setLang!: ReturnType<typeof useI18n>['setLang']

function Harness() {
  const menu = useMenu()
  cart = useCart()
  setLang = useI18n().setLang
  return <MenuScreen menu={menu} onSent={() => {}} />
}

function renderSheetApp({ url = '/?mesa=12', getMenu = async () => testMenu, getTable }: {
  url?: string
  getMenu?: () => Promise<Menu>
  getTable?: Parameters<typeof createTestServices>[0]
} = {}) {
  const services = createTestServices(getTable, getMenu)
  return { services, ...renderWithProviders(<Harness />, { url, services, i18n: true, table: true, cart: true, liveRegion: true }) }
}

const announcement = () => document.querySelector('div[role="status"][aria-live="polite"]') as HTMLElement

async function openDish(name: string) {
  await screen.findByRole('navigation')
  await userEvent.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog')
}

const addButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: /^Agregar/ })

describe('DishSheet: ficha del plato (RF2, RF6, RF14-RF20, RF34, RF43)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })
  afterEach(() => vi.restoreAllMocks())

  describe('abrir y cerrar (RF14, RF43)', () => {
    it('tocar la fila abre la ficha con nombre, descripción, etiquetas, opciones, cantidad y nota', async () => {
      renderSheetApp()
      const dialog = await openDish('Milanesa')

      expect(within(dialog).getByRole('heading', { level: 2, name: 'Milanesa' })).toBeInTheDocument()
      expect(within(dialog).getByText('Con jamón y mozzarella.')).toBeInTheDocument()
      expect(within(dialog).getByText('Picante')).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: /Cocción/ })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: /Extras/ })).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: 'Cantidad' })).toBeInTheDocument()
      expect(within(dialog).getByRole('textbox', { name: 'Nota para la cocina' })).toBeInTheDocument()
    })

    it('un plato sin opciones abre una ficha simple, lista para agregar', async () => {
      renderSheetApp()
      const dialog = await openDish('salad')
      expect(within(dialog).queryAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Cantidad'])
      expect(addButton(dialog)).toBeEnabled()
    })

    it('cierra sin agregar nada con el botón Cerrar, y el pedido queda vacío', async () => {
      renderSheetApp()
      const dialog = await openDish('salad')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(cart.lines).toEqual([])
    })

    it('Escape la cierra y el foco vuelve a la fila del plato', async () => {
      renderSheetApp()
      const row = await screen.findByRole('button', { name: 'salad' })
      await openDish('salad')

      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(row).toHaveFocus()
    })

    it('"atrás" del sistema cierra la ficha sin cambiar de pantalla (CL29)', async () => {
      renderSheetApp()
      await openDish('salad')
      expect(window.history.state).toMatchObject({ sheet: true })
      const before = window.location.href

      act(() => window.history.back())
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(window.location.href).toBe(before)
      expect(window.history.state).not.toMatchObject({ sheet: true })
    })

    it('cerrar desde la interfaz deja el historial como estaba', async () => {
      renderSheetApp()
      const dialog = await openDish('salad')
      expect(window.history.state).toMatchObject({ sheet: true })

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(window.history.state).not.toMatchObject({ sheet: true }))
    })

    it('un plato agotado no abre la ficha', async () => {
      const menu: Menu = { categories: [mains], dishes: [makeDish('gone', { available: false })] }
      renderSheetApp({ getMenu: async () => menu })
      await screen.findByRole('navigation')
      await userEvent.click(screen.getByRole('button', { name: 'gone' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('grupo obligatorio y "Agregar" (RF16, CL7)', () => {
    it('"Agregar" está deshabilitado y su descripción es el mensaje del grupo que falta', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')

      expect(addButton(dialog)).toBeDisabled()
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 1 opción')
    })

    it('al elegir la opción se habilita y la descripción desaparece', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')

      await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
      expect(addButton(dialog)).toBeEnabled()
      expect(addButton(dialog)).toHaveAccessibleDescription('')
    })

    it('con varios grupos pendientes la descripción junta todos los mensajes, y cada uno se va al cumplirse', async () => {
      renderSheetApp()
      const dialog = await openDish('combo')
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 1 opción Elegí 2 opciones')

      await userEvent.click(within(dialog).getByRole('radio', { name: 'rice' }))
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 2 opciones')
      expect(addButton(dialog)).toBeDisabled()
    })

    it('con mínimo 2 pide "Elegí 2 opciones", luego "Elegí 1 opción" y al llegar se habilita', async () => {
      renderSheetApp()
      const dialog = await openDish('icecream')
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 2 opciones')

      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'vanilla' }))
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 1 opción')
      expect(addButton(dialog)).toBeDisabled()

      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'choco' }))
      expect(addButton(dialog)).toBeEnabled()
    })

    it('el mensaje también se ve junto al botón para quien no lee el grupo (pista visual)', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')
      const footerHint = dialog.querySelector('[data-add-hint]')
      expect(footerHint).toHaveTextContent('Elegí 1 opción')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
      expect(dialog.querySelector('[data-add-hint]')).toBeNull()
    })
  })

  describe('opciones: máximo, no disponibles y grupos opcionales (RF15, RF17, CL6, CL8)', () => {
    it('una opción no disponible se ve deshabilitada y no se puede elegir', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')
      const option = within(dialog).getByRole('radio', { name: /well_done/ })
      expect(option).toBeDisabled()
      await userEvent.click(option)
      expect(addButton(dialog)).toBeDisabled()
    })

    it('al llegar al máximo del grupo múltiple las demás se deshabilitan y se anuncia el límite', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')
      await userEvent.click(within(dialog).getByRole('checkbox', { name: 'ketchup' }))
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /cheese/ }))

      expect(within(dialog).getByRole('checkbox', { name: /bacon/ })).toBeDisabled()
      expect(within(dialog).getByText('Podés elegir hasta 2')).toBeInTheDocument()
    })

    it('un grupo único opcional se puede deseleccionar volviendo a tocar la opción', async () => {
      renderSheetApp()
      const dialog = await openDish('coffee')

      await userEvent.click(within(dialog).getByRole('radio', { name: 'oat' }))
      expect(within(dialog).getByRole('radio', { name: 'oat' })).toBeChecked()
      await userEvent.click(within(dialog).getByRole('radio', { name: 'oat' }))
      expect(within(dialog).getByRole('radio', { name: 'oat' })).not.toBeChecked()

      await userEvent.click(addButton(dialog))
      await waitFor(() => expect(cart.lines).toHaveLength(1))
      expect(cart.lines[0].selection).toEqual({})
    })
  })

  describe('importe en vivo (RF18)', () => {
    it('el botón muestra (base + adicionales) × cantidad y se actualiza al cambiar opciones y cantidad', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
      expect(addButton(dialog)).toHaveTextContent(formatPrice(1200000))

      await userEvent.click(within(dialog).getByRole('checkbox', { name: /cheese/ }))
      expect(addButton(dialog)).toHaveTextContent(formatPrice(1250000))

      await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      expect(addButton(dialog)).toHaveTextContent(formatPrice(2500000))

      await userEvent.click(within(dialog).getByRole('checkbox', { name: /bacon/ }))
      expect(addButton(dialog)).toHaveTextContent(formatPrice(2660000))
    })

    it('la cantidad va de 1 a 20 en la ficha', async () => {
      renderSheetApp()
      const dialog = await openDish('salad')
      const minus = within(dialog).getByRole('button', { name: 'Disminuir cantidad' })
      expect(minus).toBeDisabled()
      for (let i = 0; i < 19; i++) await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      expect(within(dialog).getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled()
      expect(addButton(dialog)).toHaveTextContent(formatPrice(500000 * 20))
    })
  })

  describe('agregar (RF19, CL9, P6)', () => {
    it('suma la línea con sus opciones y nota, cierra la ficha y anuncia "Agregado: …"', async () => {
      renderSheetApp()
      const dialog = await openDish('burger')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'medium' }))
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /cheese/ }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nota para la cocina' }), 'sin sal')
      await userEvent.click(addButton(dialog))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(cart.lines).toHaveLength(1)
      expect(cart.lines[0]).toMatchObject({
        dishId: 'burger',
        quantity: 2,
        note: 'sin sal',
        selection: { cooking: ['medium'], extras: ['cheese'] },
      })
      await waitFor(() => expect(announcement()).toHaveTextContent('Agregado: burger × 2'))
    })

    it('la misma configuración dos veces se fusiona en una sola línea', async () => {
      renderSheetApp()
      for (let i = 0; i < 2; i++) {
        const dialog = await openDish('burger')
        await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
        await userEvent.click(addButton(dialog))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      }
      expect(cart.lines).toHaveLength(1)
      expect(cart.lines[0].quantity).toBe(2)
    })

    it('otras opciones u otra nota hacen otra línea', async () => {
      renderSheetApp()
      for (const cooking of ['rare', 'medium']) {
        const dialog = await openDish('burger')
        await userEvent.click(within(dialog).getByRole('radio', { name: cooking }))
        await userEvent.click(addButton(dialog))
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      }
      expect(cart.lines).toHaveLength(2)
    })

    it('superar 20 deja 20 y avisa "Máximo 20 por plato"', async () => {
      renderSheetApp()
      let dialog = await openDish('salad')
      for (let i = 0; i < 14; i++) await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      await userEvent.click(addButton(dialog)) // 15
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await waitFor(() => expect(announcement()).toHaveTextContent('Agregado: salad × 15'))
      expect(announcement()).not.toHaveTextContent('Máximo 20 por plato')

      dialog = await openDish('salad')
      for (let i = 0; i < 7; i++) await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      await userEvent.click(addButton(dialog)) // 8 más: 23 → 20
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      expect(cart.lines[0].quantity).toBe(20)
      await waitFor(() => expect(announcement()).toHaveTextContent('Máximo 20 por plato'))
    })

    it('una ficha nueva arranca limpia: cantidad 1, sin nota ni opciones de la anterior', async () => {
      renderSheetApp()
      let dialog = await openDish('burger')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nota para la cocina' }), 'hola')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      dialog = await openDish('burger')
      expect(within(dialog).getByRole('radio', { name: 'rare' })).not.toBeChecked()
      expect(within(dialog).getByRole('textbox', { name: 'Nota para la cocina' })).toHaveValue('')
    })

    it('guarda el pedido en curso en sessionStorage (RF23)', async () => {
      renderSheetApp()
      const dialog = await openDish('salad')
      await userEvent.click(addButton(dialog))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      const stored = JSON.parse(window.sessionStorage.getItem('restaurante.cart.table-12')!)
      expect(stored.lines).toEqual([{ dishId: 'salad', quantity: 1, selection: {}, note: '' }])
    })
  })

  describe('sin mesa válida: solo lectura (RF2, RF3, RF41, CL1)', () => {
    it('sin ?mesa= se puede ver la ficha, pero no hay "Agregar" y se explica por qué', async () => {
      renderSheetApp({ url: '/' })
      const dialog = await openDish('burger')

      expect(within(dialog).queryByRole('button', { name: /^Agregar/ })).not.toBeInTheDocument()
      expect(within(dialog).getByText(/escaneá el código QR de tu mesa/)).toBeInTheDocument()
      expect(within(dialog).getByRole('group', { name: /cooking/ })).toBeInTheDocument()
    })

    it('con una mesa que no existe tampoco se agrega', async () => {
      renderSheetApp({ getTable: async () => null })
      const dialog = await openDish('burger')
      await waitFor(() => expect(within(dialog).getByText(/escaneá el código QR de tu mesa/)).toBeInTheDocument())
      expect(within(dialog).queryByRole('button', { name: /^Agregar/ })).not.toBeInTheDocument()
    })

    it('mientras se verifica la mesa no se puede agregar y avisa que se está verificando', async () => {
      renderSheetApp({ getTable: () => new Promise(() => {}) })
      const dialog = await openDish('burger')
      expect(within(dialog).getByText('Verificando tu mesa')).toBeInTheDocument()
      expect(within(dialog).queryByRole('button', { name: /^Agregar/ })).not.toBeInTheDocument()
    })

    it('si la mesa no se pudo verificar ofrece "Reintentar" y, al lograrlo, aparece "Agregar"', async () => {
      let fail = true
      renderSheetApp({
        getTable: async (id) => {
          if (fail) throw new Error('sin red')
          return { id }
        },
      })
      const dialog = await openDish('salad')
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Reintentar' })).toBeInTheDocument())

      fail = false
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reintentar' }))
      await waitFor(() => expect(addButton(dialog)).toBeEnabled())
    })
  })

  describe('idioma (RF34, CL19)', () => {
    it('cambiar de idioma con la ficha abierta traduce todo y conserva la selección, la cantidad y la nota', async () => {
      renderSheetApp()
      const dialog = await openDish('Milanesa')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'medium' }))
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /cheese/ }))
      await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
      await userEvent.type(within(dialog).getByRole('textbox', { name: 'Nota para la cocina' }), 'no salt')

      act(() => setLang('en'))

      const english = await screen.findByRole('dialog', { name: 'Cutlet' })
      expect(within(english).getByText('With ham and mozzarella.')).toBeInTheDocument()
      expect(within(english).getByRole('group', { name: /Doneness/ })).toBeInTheDocument()
      expect(within(english).getByRole('radio', { name: 'medium' })).toBeChecked()
      expect(within(english).getByRole('checkbox', { name: /cheese/ })).toBeChecked()
      expect(within(english).getByRole('textbox', { name: 'Note for the kitchen' })).toHaveValue('no salt')
      expect(within(english).getByRole('button', { name: /^Add/ })).toHaveTextContent(formatPrice(2100000, 'en'))
      expect(within(english).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    })
  })

  describe('la carta cambia con la ficha abierta (RF44)', () => {
    const refresh = () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
    }

    it('si una opción elegida deja de estar disponible, "Agregar" se apaga y vuelve a pedir elegir', async () => {
      let current = testMenu
      renderSheetApp({ getMenu: async () => current })
      const dialog = await openDish('burger')
      await userEvent.click(within(dialog).getByRole('radio', { name: 'medium' }))
      expect(addButton(dialog)).toBeEnabled()

      current = {
        ...testMenu,
        dishes: testMenu.dishes.map((d) =>
          d.id === 'burger'
            ? {
                ...d,
                optionGroups: d.optionGroups.map((g) =>
                  g.id === 'cooking' ? { ...g, options: g.options.map((o) => (o.id === 'medium' ? { ...o, available: false } : o)) } : g,
                ),
              }
            : d,
        ),
      }
      refresh()

      await waitFor(() => expect(addButton(dialog)).toBeDisabled())
      expect(addButton(dialog)).toHaveAccessibleDescription('Elegí 1 opción')
      expect(within(dialog).getByRole('radio', { name: /medium/ })).not.toBeChecked()
    })

    it('si el plato se agota con la ficha abierta, no se puede agregar', async () => {
      let current = testMenu
      renderSheetApp({ getMenu: async () => current })
      const dialog = await openDish('salad')
      expect(addButton(dialog)).toBeEnabled()

      current = { ...testMenu, dishes: testMenu.dishes.map((d) => (d.id === 'salad' ? { ...d, available: false } : d)) }
      refresh()

      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Agotado' })).toBeDisabled())
      expect(within(dialog).queryByRole('button', { name: /^Agregar/ })).not.toBeInTheDocument()
    })

    it('si el plato sale de la carta, la ficha se cierra', async () => {
      let current = testMenu
      renderSheetApp({ getMenu: async () => current })
      await openDish('salad')

      current = { ...testMenu, dishes: testMenu.dishes.filter((d) => d.id !== 'salad') }
      refresh()
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  describe('accesibilidad (RNF6)', () => {
    it('no tiene violaciones: con grupos, con selección hecha y sin mesa', async () => {
      const first = renderSheetApp()
      let dialog = await openDish('burger')
      await expectNoA11yViolations(dialog)
      await userEvent.click(within(dialog).getByRole('radio', { name: 'rare' }))
      await userEvent.click(within(dialog).getByRole('checkbox', { name: /cheese/ }))
      await expectNoA11yViolations(dialog)
      first.unmount()

      renderSheetApp({ url: '/' })
      dialog = await openDish('burger')
      await expectNoA11yViolations(dialog)
    })
  })
})
