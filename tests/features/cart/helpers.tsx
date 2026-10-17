// Ayudas compartidas de los tests del pedido en curso (T8): un entorno completo con mesa, pedido y región viva,
// y una sonda que deja el pedido en `cart` para llenarlo desde el test.
import type { ReactElement } from 'react'
import { MotionConfig } from 'motion/react'
import { act } from '@testing-library/react'
import type { Menu } from '../../../src/domain/types'
import { useCart } from '../../../src/state/CartContext'
import type { Cart } from '../../../src/state/CartContext'
import { useTable } from '../../../src/state/TableContext'
import type { Table } from '../../../src/state/TableContext'
import { burger, mains, salad, starters } from '../../fixtures/menu'
import { createTestServices } from '../../fixtures/services'
import { renderWithProviders } from '../../utils'

export const cartMenu: Menu = { categories: [starters, mains], dishes: [salad, burger] }

export let cart!: Cart
export let table!: Table

/** Sonda: no dibuja nada, solo deja el pedido y la mesa vigentes en `cart` y `table`. */
export function CartProbe() {
  cart = useCart()
  table = useTable()
  return null
}

export function renderCartUi(ui: ReactElement, { url = '/?mesa=12', services = createTestServices() } = {}) {
  return {
    services,
    ...renderWithProviders(
      <>
        <CartProbe />
        {ui}
      </>,
      { url, services, i18n: true, liveRegion: true, table: true, cart: true },
    ),
  }
}

/** Mismo entorno pero con el movimiento activado (los tests usan "reducido" por defecto). */
export function withMotion(ui: ReactElement) {
  return <MotionConfig transition={{ duration: 0 }} reducedMotion="never">{ui}</MotionConfig>
}

export const addDish = (dishId: string, quantity = 1, selection: Record<string, string[]> = {}, note = '') =>
  act(() => void cart.addLine({ dishId, selection, note, quantity }))
