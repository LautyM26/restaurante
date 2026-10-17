// MenuScreen con el pedido en curso (T8): la barra, el resumen y su relación con la ficha (RF2, RF19, RF21, RF26).
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Menu, Order } from '../../../src/domain/types'
import { MenuScreen } from '../../../src/features/menu/MenuScreen'
import { ServiceError } from '../../../src/services/contracts'
import { useMenu } from '../../../src/state/useMenu'
import type { FakeOrderService } from '../../fixtures/fakeOrderService'
import { burger, cookingGroup, extrasGroup, mains, salad, starters } from '../../fixtures/menu'
import { makeOrder } from '../../fixtures/orders'
import { createTestServices } from '../../fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const menu: Menu = { categories: [starters, mains], dishes: [salad, burger] }
const noRare: Menu = {
  categories: [starters, mains],
  dishes: [
    salad,
    {
      ...burger,
      optionGroups: [
        { ...cookingGroup, options: cookingGroup.options.map((o) => (o.id === 'rare' ? { ...o, available: false } : o)) },
        extrasGroup,
      ],
    },
  ],
}

const sent = () => makeOrder({ id: 'order-9', code: 'K7F2', tableId: 12, totalCents: 500000 })

// `prepare` configura el servicio ANTES de montar: al montar con un intento pendiente se consulta enseguida.
function setup(getMenu: () => Promise<Menu> = async () => menu, prepare?: (orders: FakeOrderService) => void) {
  const onSent = vi.fn<(order: Order) => void>()
  function Harness() {
    return (
      <main>
        <MenuScreen menu={useMenu()} onSent={onSent} />
      </main>
    )
  }
  const services = createTestServices(undefined, getMenu)
  const orders = services.orderService as FakeOrderService
  prepare?.(orders)
  const view = renderWithProviders(<Harness />, { url: '/?mesa=12', services, i18n: true, table: true, cart: true, liveRegion: true })
  return { orders, onSent, ...view }
}

const bar = () => screen.queryByRole('button', { name: /Ver pedido/ })
async function addFromSheet(dishName: string, times = 1) {
  await userEvent.click(await screen.findByRole('button', { name: dishName }))
  const dialog = await screen.findByRole('dialog')
  for (let i = 1; i < times; i++) await userEvent.click(within(dialog).getByRole('button', { name: 'Aumentar cantidad' }))
  await userEvent.click(within(dialog).getByRole('button', { name: /^Agregar/ }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('MenuScreen con el pedido en curso (T8)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('sin platos en el pedido no hay barra; al agregar uno desde la ficha aparece con las unidades y el total (RF21)', async () => {
    setup()
    await screen.findByRole('button', { name: 'salad' })
    expect(bar()).not.toBeInTheDocument()

    await addFromSheet('salad', 2)

    expect(await screen.findByRole('button', { name: /Ver pedido.*2 unidades.*\$\s10\.000/ })).toBeInTheDocument()
  })

  it('tocar la barra abre el resumen con las líneas', async () => {
    setup()
    await addFromSheet('salad')

    await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))

    const dialog = await screen.findByRole('dialog', { name: 'Tu pedido' })
    expect(within(dialog).getByRole('group', { name: 'Cantidad: salad' })).toBeInTheDocument()
  })

  it('el flujo completo: agregar, abrir el resumen, enviar → onSent con el pedido y el pedido en curso queda vacío', async () => {
    const { orders, onSent } = setup()
    orders.createOrder.mockResolvedValue(sent())
    await addFromSheet('salad')
    await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))

    await userEvent.click(await screen.findByRole('button', { name: /^Enviar pedido/ }))

    await waitFor(() => expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ code: 'K7F2' })))
    await waitFor(() => expect(bar()).not.toBeInTheDocument())
    expect(window.sessionStorage.getItem('restaurante.cart.table-12')).toBeNull()
  })

  it('al quitar la última línea el resumen se cierra solo y desaparece la barra', async () => {
    setup()
    await addFromSheet('salad')
    await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Tu pedido' })

    await userEvent.click(within(dialog).getByRole('button', { name: 'Quitar' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(bar()).not.toBeInTheDocument()
  })

  it('una línea cuya opción se agotó se puede volver a elegir: la ficha se abre por encima del resumen, que sigue abierto', async () => {
    window.sessionStorage.setItem(
      'restaurante.cart.table-12',
      JSON.stringify({ lines: [{ dishId: 'burger', quantity: 1, selection: { cooking: ['rare'] }, note: '' }], note: '' }),
    )
    setup(async () => noRare)
    await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Elegir de nuevo: burger' }))

    const dialogs = await screen.findAllByRole('dialog')
    expect(dialogs).toHaveLength(2)
    const ficha = dialogs.find((d) => within(d).queryByRole('radio', { name: 'medium' }))!
    await userEvent.click(within(ficha).getByRole('radio', { name: 'medium' }))
    await userEvent.click(within(ficha).getByRole('button', { name: /^Agregar/ }))

    await waitFor(() => expect(screen.getAllByRole('dialog')).toHaveLength(1))
    const resumen = screen.getByRole('dialog', { name: 'Tu pedido' })
    expect(within(resumen).getAllByRole('listitem')).toHaveLength(2)
  })

  describe('con un envío sin resolver el pedido no se puede modificar (RF26)', () => {
    async function mountUnresolved() {
      window.sessionStorage.setItem(
        'restaurante.cart.table-12',
        JSON.stringify({
          lines: [{ dishId: 'salad', quantity: 1, selection: {}, note: '' }],
          note: '',
          pending: { clientRequestId: 'req-1', fingerprint: 'huella', startedAt: '2026-10-11T12:00:00.000Z' },
        }),
      )
      const view = setup(undefined, (orders) =>
        orders.findByClientRequestId.mockRejectedValue(new ServiceError('NETWORK', 'sin red')),
      )
      await screen.findByRole('button', { name: 'salad' })
      return view
    }

    it('la ficha no deja agregar y lo explica', async () => {
      await mountUnresolved()
      await userEvent.click(screen.getByRole('button', { name: 'salad' }))
      const dialog = await screen.findByRole('dialog')

      const add = within(dialog).getByRole('button', { name: /^Agregar/ })
      expect(add).toBeDisabled()
      expect(add).toHaveAccessibleDescription('Tu pedido se está enviando y por ahora no se puede modificar.')
    })

    it('el resumen muestra el error y "Reintentar" / "Editar pedido" desde el primer momento (recarga con intento pendiente)', async () => {
      await mountUnresolved()
      await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))

      expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Editar pedido' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Aumentar cantidad' })).not.toBeInTheDocument()
    })

    it('"Editar pedido" con el intento no registrado libera todo: ya se puede agregar', async () => {
      const { orders } = await mountUnresolved()
      await userEvent.click(await screen.findByRole('button', { name: /Ver pedido/ }))
      await screen.findByRole('button', { name: 'Editar pedido' })
      orders.findByClientRequestId.mockResolvedValue(null)
      await userEvent.click(screen.getByRole('button', { name: 'Editar pedido' }))
      await screen.findByRole('button', { name: 'Aumentar cantidad' })
      await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await userEvent.click(screen.getByRole('button', { name: 'salad' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByRole('button', { name: /^Agregar/ })).toBeEnabled()
    })
  })

  it('"Máximo 20 por plato" se ve junto a la barra, no solo se anuncia (RF19, P6)', async () => {
    setup()
    await addFromSheet('salad', 20)
    expect(screen.queryByText('Máximo 20 por plato')).not.toBeInTheDocument()

    await addFromSheet('salad')

    expect(await screen.findByText('Máximo 20 por plato')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /20 unidades/ })).toBeInTheDocument()
  })

  it('no tiene violaciones de accesibilidad con la barra ni con el resumen abierto', async () => {
    const { container } = setup()
    await addFromSheet('salad', 2)
    await screen.findByRole('button', { name: /Ver pedido/ })
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('button', { name: /Ver pedido/ }))
    await screen.findByRole('dialog', { name: 'Tu pedido' })
    await expectNoA11yViolations(document.body)
  })
})
