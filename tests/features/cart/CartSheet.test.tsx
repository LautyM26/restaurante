import { useState } from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lineKey } from '../../../src/domain/cart'
import type { Menu, Order } from '../../../src/domain/types'
import { CartSheet } from '../../../src/features/cart/CartSheet'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { ServiceError } from '../../../src/services/contracts'
import { createSafeStorage } from '../../../src/services/storage'
import { createMyOrdersStore } from '../../../src/state/myOrdersStore'
import { useSubmitOrder } from '../../../src/state/useSubmitOrder'
import type { FakeOrderService } from '../../fixtures/fakeOrderService'
import { burger, cookingGroup, extrasGroup, mains, salad, starters } from '../../fixtures/menu'
import { makeOrder } from '../../fixtures/orders'
import { createTestServices } from '../../fixtures/services'
import { createMemoryStorage } from '../../fixtures/storage'
import { expectNoA11yViolations } from '../../utils'
import { addDish, cart, cartMenu, renderCartUi, table } from './helpers'

const saladKey = lineKey('salad', {}, '')
const rare = { cooking: ['rare'] }
const medium = { cooking: ['medium'] }
const rareKey = lineKey('burger', rare, '')

// Carta con la cocción "rare" agotada: solo la línea de la hamburguesa "rare" deja de ser válida.
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
const noSalad: Menu = { categories: [starters, mains], dishes: [{ ...salad, available: false }, burger] }

const sent = (overrides = {}) => makeOrder({ id: 'order-9', code: 'K7F2', tableId: 12, totalCents: 1000000, ...overrides })
const network = () => new ServiceError('NETWORK', 'sin red')

interface Setup {
  menu?: Menu | null
  url?: string
  onSent?: ReturnType<typeof vi.fn<(order: Order) => void>>
  onReopenDish?: ReturnType<typeof vi.fn<(dishId: string) => void>>
}

function Harness({ menu, onSent, onReopenDish }: Required<Pick<Setup, 'onSent' | 'onReopenDish'>> & { menu: Menu | null }) {
  const [open, setOpen] = useState(true)
  const [store] = useState(() => createMyOrdersStore({ storage: createSafeStorage(() => createMemoryStorage()), target: new EventTarget() }))
  const submit = useSubmitOrder({ menu, onSent, refreshMenu: vi.fn(), store })
  return <CartSheet open={open} onClose={() => setOpen(false)} menu={menu} submit={submit} onReopenDish={onReopenDish} />
}

function setup({ menu = cartMenu, url, onSent = vi.fn<(order: Order) => void>(), onReopenDish = vi.fn<(dishId: string) => void>() }: Setup = {}) {
  const services = createTestServices()
  const orders = services.orderService as FakeOrderService
  const view = renderCartUi(<Harness menu={menu} onSent={onSent} onReopenDish={onReopenDish} />, { url, services })
  return { orders, onSent, onReopenDish, ...view }
}

const dialog = () => screen.getByRole('dialog', { name: 'Tu pedido' })
const sendButton = () => screen.queryByRole('button', { name: /^Enviar pedido/ })
const lineOf = (name: string) => within(dialog()).getAllByRole('listitem').find((li) => li.textContent?.includes(name))!

describe('CartSheet: resumen y envío del pedido (RF2, RF20-RF22, RF24-RF27, RF44; plan §5.4)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  describe('el resumen', () => {
    it('es un diálogo "Tu pedido" con la mesa, cada línea (nombre, opciones, nota, importe) y el total', async () => {
      setup()
      addDish('salad', 2)
      addDish('burger', 1, { cooking: ['rare'], extras: ['cheese'] }, 'bien caliente')

      await screen.findByRole('dialog', { name: 'Tu pedido' })
      expect(within(dialog()).getByText('Mesa 12')).toBeInTheDocument()
      const salad2 = lineOf('salad')
      expect(salad2).toHaveTextContent(/\$\s10\.000/)
      const burgerLine = lineOf('burger')
      expect(burgerLine).toHaveTextContent('rare, cheese')
      expect(burgerLine).toHaveTextContent('bien caliente')
      expect(burgerLine).toHaveTextContent(/\$\s12\.500/)
      expect(within(dialog()).getByText('Total').parentElement).toHaveTextContent(/\$\s22\.500/)
    })

    it('cambiar cantidades recalcula el total al instante y "Quitar" saca la línea', async () => {
      setup()
      addDish('salad', 1)
      addDish('burger', 1, rare)
      await screen.findByRole('dialog')

      const saladGroup = within(dialog()).getByRole('group', { name: 'Cantidad: salad' })
      await userEvent.click(within(saladGroup).getByRole('button', { name: 'Aumentar cantidad' }))
      expect(within(dialog()).getByText('Total').parentElement).toHaveTextContent(/\$\s22\.000/)
      expect(cart.lines.find((l) => l.key === saladKey)?.quantity).toBe(2)

      await userEvent.click(within(saladGroup).getByRole('button', { name: 'Disminuir cantidad' }))
      expect(cart.lines.find((l) => l.key === saladKey)?.quantity).toBe(1)

      // En 1 el mismo botón es "Quitar" (RF20): la cantidad nunca llega a 0
      await userEvent.click(within(saladGroup).getByRole('button', { name: 'Quitar' }))
      expect(cart.lines.map((l) => l.dishId)).toEqual(['burger'])
      expect(within(dialog()).getByText('Total').parentElement).toHaveTextContent(/\$\s12\.000/)
    })

    it('la cantidad no pasa de 20 en el resumen', async () => {
      setup()
      addDish('salad', 20)
      await screen.findByRole('dialog')
      expect(within(dialog()).getByRole('button', { name: 'Aumentar cantidad' })).toBeDisabled()
    })

    it('la nota general admite hasta 200 caracteres y se guarda en el pedido', async () => {
      setup()
      addDish('salad')
      await screen.findByRole('dialog')

      const note = within(dialog()).getByRole('textbox', { name: 'Nota para todo el pedido' })
      expect(note).toHaveAccessibleDescription('0 de 200')
      await userEvent.click(note)
      await userEvent.paste('a'.repeat(250))

      expect(cart.note).toHaveLength(200)
      expect(note).toHaveAccessibleDescription('200 de 200')
    })
  })

  describe('líneas que ya no son válidas frente a la carta vigente (RF44, CL15, CL27)', () => {
    it('marca la línea con su motivo y bloquea el envío hasta quitarla', async () => {
      setup({ menu: noSalad })
      addDish('salad')
      addDish('burger', 1, rare)
      await screen.findByRole('dialog')

      expect(lineOf('salad')).toHaveTextContent('Este plato ya no está disponible. Quitalo para continuar.')
      expect(lineOf('burger')).not.toHaveTextContent('ya no está disponible')
      expect(sendButton()).toBeDisabled()
      expect(screen.getByRole('alert')).toHaveTextContent('Quitá los platos marcados para poder enviar el pedido.')

      await userEvent.click(within(lineOf('salad')).getByRole('button', { name: 'Quitar' }))
      await waitFor(() => expect(sendButton()).toBeEnabled())
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('una línea de un plato que ya no existe se marca sin nombre y se puede quitar', async () => {
      setup({ menu: { categories: [starters, mains], dishes: [burger] } })
      addDish('salad')
      await screen.findByRole('dialog')

      const line = within(dialog()).getAllByRole('listitem')[0]
      expect(line).toHaveTextContent('Plato que ya no está en la carta')
      expect(line).toHaveTextContent('Este plato ya no está en la carta. Quitalo para continuar.')
      await userEvent.click(within(line).getByRole('button', { name: 'Quitar' }))
      expect(cart.lines).toEqual([])
    })

    it('con dos líneas del mismo plato marca solo la que tiene la opción no disponible', async () => {
      setup({ menu: noRare })
      addDish('burger', 1, rare)
      addDish('burger', 1, medium)
      await screen.findByRole('dialog')

      const [first, second] = within(dialog()).getAllByRole('listitem')
      expect(first).toHaveTextContent('Una opción elegida ya no está disponible. Quitá el plato y volvé a agregarlo.')
      expect(second).not.toHaveTextContent('ya no está disponible')
      expect(sendButton()).toBeDisabled()
    })

    it('"Elegir de nuevo" reabre la ficha del plato si el plato sigue pudiéndose pedir', async () => {
      const { onReopenDish } = setup({ menu: noRare })
      addDish('burger', 1, rare)
      await screen.findByRole('dialog')

      await userEvent.click(screen.getByRole('button', { name: 'Elegir de nuevo: burger' }))
      expect(onReopenDish).toHaveBeenCalledWith('burger')
    })

    it('si el plato se agotó no ofrece reabrir la ficha (no hay nada que elegir)', async () => {
      setup({ menu: noSalad })
      addDish('salad')
      await screen.findByRole('dialog')
      expect(screen.queryByRole('button', { name: /Elegir de nuevo/ })).not.toBeInTheDocument()
    })
  })

  describe('sin mesa válida (RF2)', () => {
    it('en lugar de "Enviar pedido" muestra el aviso de la mesa', async () => {
      setup({ url: '/' })
      addDish('salad')
      await screen.findByRole('dialog')

      expect(sendButton()).not.toBeInTheDocument()
      expect(within(dialog()).getByText(/escaneá el código QR de tu mesa/)).toBeInTheDocument()
    })

    it('con la mesa aún verificándose no se puede enviar', async () => {
      const services = createTestServices(() => new Promise(() => {}))
      renderCartUi(<Harness menu={cartMenu} onSent={vi.fn()} onReopenDish={vi.fn()} />, { services })
      addDish('salad')
      await screen.findByRole('dialog')
      expect(sendButton()).not.toBeInTheDocument()
      expect(within(dialog()).getByText('Verificando tu mesa')).toBeInTheDocument()
    })
  })

  describe('enviar', () => {
    it('"Enviar pedido" muestra el total, envía y avisa al terminar', async () => {
      const { orders, onSent } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder.mockResolvedValue(sent())
      expect(sendButton()).toHaveTextContent(/\$\s10\.000/)

      await userEvent.click(sendButton()!)

      await waitFor(() => expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ code: 'K7F2' })))
      expect(orders.createOrder).toHaveBeenCalledTimes(1)
    })

    it('mientras envía el botón dice "Enviando pedido", está ocupado y no vuelve a enviar', async () => {
      const { orders } = setup()
      addDish('salad')
      await screen.findByRole('dialog')
      orders.createOrder.mockImplementation(() => new Promise(() => {}))

      await userEvent.click(sendButton()!)

      const busy = await screen.findByRole('button', { name: 'Enviando pedido' })
      expect(busy).toHaveAttribute('aria-busy', 'true')
      await userEvent.click(busy)
      expect(orders.createOrder).toHaveBeenCalledTimes(1)
    })

    it('dos toques rápidos en "Enviar" crean un solo pedido (CL11)', async () => {
      const { orders } = setup()
      addDish('salad')
      await screen.findByRole('dialog')
      orders.createOrder.mockResolvedValue(sent())

      await userEvent.dblClick(sendButton()!)

      expect(orders.createOrder).toHaveBeenCalledTimes(1)
    })

    it('con el pedido vacío no hay nada que enviar', async () => {
      setup()
      await screen.findByRole('dialog')
      expect(sendButton()).toBeDisabled()
    })

    it('sin la carta cargada no se puede enviar', async () => {
      setup({ menu: null })
      addDish('salad')
      await screen.findByRole('dialog')
      expect(sendButton()).toBeDisabled()
    })
  })

  describe('el resultado es desconocido (RF26, CL12)', () => {
    async function failToSend() {
      const view = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      view.orders.createOrder.mockRejectedValueOnce(network())
      await userEvent.click(sendButton()!)
      await screen.findByRole('button', { name: 'Reintentar' })
      return view
    }

    it('explica el error, bloquea la edición y ofrece "Reintentar" y "Editar pedido"', async () => {
      await failToSend()

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('No pudimos enviar el pedido. Revisá tu conexión y probá de nuevo.')
      expect(alert).toHaveTextContent('No sabemos si el pedido llegó. Reintentá: no se va a duplicar.')
      expect(screen.getByRole('button', { name: 'Editar pedido' })).toBeInTheDocument()
      // Edición bloqueada: ni cantidades, ni "Quitar", ni nota editable
      expect(screen.queryByRole('button', { name: 'Aumentar cantidad' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
      expect(sendButton()).not.toBeInTheDocument()
      expect(alert).toHaveFocus()
    })

    it('"Reintentar" reenvía con el mismo clientRequestId y no duplica', async () => {
      const { orders, onSent } = await failToSend()
      orders.createOrder.mockResolvedValueOnce(sent())

      await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))

      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
      const [first, second] = orders.createOrder.mock.calls.map(([input]) => input.clientRequestId)
      expect(second).toBe(first)
    })

    it('"Editar pedido" sin que el restaurante lo haya registrado devuelve la edición', async () => {
      const { orders } = await failToSend()
      orders.findByClientRequestId.mockResolvedValue(null)

      await userEvent.click(screen.getByRole('button', { name: 'Editar pedido' }))

      expect(await screen.findByRole('button', { name: 'Aumentar cantidad' })).toBeInTheDocument()
      expect(sendButton()).toBeEnabled()
      expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    })

    it('"Editar pedido" y el restaurante sí lo tenía: se trata como enviado (CL28)', async () => {
      const { orders, onSent } = await failToSend()
      orders.findByClientRequestId.mockResolvedValue(sent())

      await userEvent.click(screen.getByRole('button', { name: 'Editar pedido' }))

      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
      expect(cart.lines).toEqual([])
    })

    it('si tampoco se puede consultar, sigue bloqueado y dice "Sin conexión. Probá de nuevo."', async () => {
      const { orders } = await failToSend()
      orders.findByClientRequestId.mockRejectedValue(network())

      await userEvent.click(screen.getByRole('button', { name: 'Editar pedido' }))

      expect(await screen.findByText('Sin conexión. Probá de nuevo.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Aumentar cantidad' })).not.toBeInTheDocument()
    })

    it.each(['SERVER', 'IDEMPOTENCY_CONFLICT'] as const)('%s se muestra como intento sin resolver', async (code) => {
      const { orders } = setup()
      addDish('salad')
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(new ServiceError(code, 'x'))

      await userEvent.click(sendButton()!)

      expect(await screen.findByRole('alert')).toHaveTextContent('No sabemos si el pedido llegó')
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    })
  })

  describe('el restaurante rechaza el pedido (RF27, RF46)', () => {
    it('LINES_REJECTED señala cada línea afectada con su motivo y pide quitarla antes de reenviar', async () => {
      const { orders } = setup()
      addDish('burger', 1, rare)
      addDish('burger', 1, medium)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(
        new ServiceError('LINES_REJECTED', 'x', {
          lines: [{ lineId: rareKey, dishId: 'burger', reason: 'option_unavailable', groupId: 'cooking', optionId: 'rare' }],
        }),
      )

      await userEvent.click(sendButton()!)

      await waitFor(() => expect(sendButton()).toBeDisabled())
      const [first, second] = within(dialog()).getAllByRole('listitem')
      expect(first).toHaveTextContent('Una opción elegida ya no está disponible')
      expect(second).not.toHaveTextContent('ya no está disponible')
      expect(screen.getByRole('alert')).toHaveTextContent('Quitá los platos marcados')

      await userEvent.click(within(first).getByRole('button', { name: 'Quitar' }))
      await waitFor(() => expect(sendButton()).toBeEnabled())
    })

    it('un plato agotado que la carta local todavía no sabe: la línea se marca igual con lo que dijo el restaurante', async () => {
      const { orders } = setup()
      addDish('salad')
      addDish('burger', 1, rare)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(
        new ServiceError('LINES_REJECTED', 'x', { lines: [{ lineId: saladKey, dishId: 'salad', reason: 'dish_unavailable' }] }),
      )

      await userEvent.click(sendButton()!)

      await waitFor(() => expect(lineOf('salad')).toHaveTextContent('Este plato ya no está disponible. Quitalo para continuar.'))
      expect(lineOf('burger')).not.toHaveTextContent('ya no está disponible')
    })

    it('PRICE_CHANGED frena el envío y muestra el aviso con los totales; no hay "Enviar pedido" hasta decidir', async () => {
      const { orders } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(
        new ServiceError('PRICE_CHANGED', 'x', { totalCents: 1400000, priceLines: [{ lineId: saladKey, unitPriceCents: 700000 }] }),
      )

      await userEvent.click(sendButton()!)

      const notice = await screen.findByRole('alert')
      expect(notice).toHaveTextContent('El total cambió')
      expect(notice).toHaveTextContent(/Antes \$\s10\.000, ahora \$\s14\.000/)
      expect(notice).toHaveTextContent(/salad: antes \$\s5\.000, ahora \$\s7\.000/)
      expect(sendButton()).not.toBeInTheDocument()
      expect(cart.lines).toHaveLength(1)
    })

    it('"Aceptar y enviar" envía con el total nuevo', async () => {
      const { orders, onSent } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder
        .mockRejectedValueOnce(
          new ServiceError('PRICE_CHANGED', 'x', { totalCents: 1400000, priceLines: [{ lineId: saladKey, unitPriceCents: 700000 }] }),
        )
        .mockResolvedValueOnce(sent({ totalCents: 1400000 }))
      await userEvent.click(sendButton()!)

      await userEvent.click(await screen.findByRole('button', { name: /Aceptar y enviar/ }))

      await waitFor(() => expect(onSent).toHaveBeenCalledTimes(1))
      expect(orders.createOrder.mock.calls[1][0].expectedTotalCents).toBe(1400000)
    })

    it('"Revisar pedido" vuelve al resumen editable sin enviar nada (CL38)', async () => {
      const { orders, onSent } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(
        new ServiceError('PRICE_CHANGED', 'x', { totalCents: 1400000, priceLines: [{ lineId: saladKey, unitPriceCents: 700000 }] }),
      )
      await userEvent.click(sendButton()!)

      await userEvent.click(await screen.findByRole('button', { name: 'Revisar pedido' }))

      expect(screen.queryByText('El total cambió')).not.toBeInTheDocument()
      expect(sendButton()).toBeEnabled()
      expect(screen.getAllByRole('button', { name: 'Aumentar cantidad' })).toHaveLength(1)
      expect(orders.createOrder).toHaveBeenCalledTimes(1)
      expect(onSent).not.toHaveBeenCalled()
    })

    it('INVALID_TABLE: avisa de la mesa, conserva el pedido y no deja enviar (CL1)', async () => {
      const { orders } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(new ServiceError('INVALID_TABLE', 'x'))

      await userEvent.click(sendButton()!)

      await waitFor(() => expect(table.status).toBe('invalid'))
      expect(within(dialog()).getByText(/escaneá el código QR de tu mesa/)).toBeInTheDocument()
      expect(sendButton()).not.toBeInTheDocument()
      expect(within(dialog()).getAllByRole('listitem')).toHaveLength(1)
      expect(cart.lines[0].quantity).toBe(2)
    })

    it('VALIDATION avisa que revise cantidades y notas, y deja volver a enviar', async () => {
      const { orders } = setup()
      addDish('salad')
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(new ServiceError('VALIDATION', 'x'))

      await userEvent.click(sendButton()!)

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos procesar el pedido. Revisá cantidades y notas.')
      expect(sendButton()).toBeEnabled()
    })
  })

  describe('idioma y accesibilidad', () => {
    it('en inglés', async () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      const { orders } = setup()
      addDish('salad', 2)

      expect(await screen.findByRole('dialog', { name: 'Your order' })).toBeInTheDocument()
      expect(within(screen.getByRole('dialog')).getByText('Table 12')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Note for the whole order' })).toBeInTheDocument()
      orders.createOrder.mockImplementation(() => new Promise(() => {}))
      await userEvent.click(screen.getByRole('button', { name: /^Send order/ }))
      expect(await screen.findByRole('button', { name: 'Sending order' })).toBeInTheDocument()
    })

    it('no tiene violaciones de accesibilidad con líneas, nota y total', async () => {
      setup()
      addDish('salad', 2)
      addDish('burger', 1, rare, 'nota')
      await screen.findByRole('dialog')
      await expectNoA11yViolations(document.body)
    })

    it('no tiene violaciones de accesibilidad con una línea no válida marcada', async () => {
      setup({ menu: noRare })
      addDish('burger', 1, rare)
      await screen.findByRole('dialog')
      await expectNoA11yViolations(document.body)
    })

    it('no tiene violaciones de accesibilidad con el envío sin resolver', async () => {
      const { orders } = setup()
      addDish('salad')
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(network())
      await userEvent.click(sendButton()!)
      await screen.findByRole('button', { name: 'Reintentar' })
      await expectNoA11yViolations(document.body)
    })

    it('no tiene violaciones de accesibilidad con el aviso de precio', async () => {
      const { orders } = setup()
      addDish('salad', 2)
      await screen.findByRole('dialog')
      orders.createOrder.mockRejectedValueOnce(
        new ServiceError('PRICE_CHANGED', 'x', { totalCents: 1400000, priceLines: [{ lineId: saladKey, unitPriceCents: 700000 }] }),
      )
      await userEvent.click(sendButton()!)
      await screen.findByText('El total cambió')
      await expectNoA11yViolations(document.body)
    })
  })
})

