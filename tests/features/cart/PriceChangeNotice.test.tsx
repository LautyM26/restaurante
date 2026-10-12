import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PriceChangeNotice } from '../../../src/features/cart/PriceChangeNotice'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const lines = [
  { name: 'Ensalada', oldUnitCents: 500000, newUnitCents: 700000 },
  { name: 'Bife de chorizo', oldUnitCents: 1200000, newUnitCents: 1100000 },
]

function renderNotice(props: Partial<Parameters<typeof PriceChangeNotice>[0]> = {}) {
  const onAccept = vi.fn()
  const onReview = vi.fn()
  const view = renderWithProviders(
    <PriceChangeNotice oldTotalCents={1000000} newTotalCents={1400000} lines={lines} onAccept={onAccept} onReview={onReview} {...props} />,
    { i18n: true },
  )
  return { onAccept, onReview, ...view }
}

describe('PriceChangeNotice: el total cambió, el cliente decide (RF46, CL14, CL38)', () => {
  beforeEach(() => window.localStorage.clear())

  it('es una alerta que explica qué pasó: total viejo y total nuevo', () => {
    renderNotice()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('El total cambió')
    expect(alert).toHaveTextContent(/Antes \$\s10\.000, ahora \$\s14\.000\./)
  })

  it('lista las líneas que cambiaron con su precio de antes y de ahora (también si bajó)', () => {
    renderNotice()
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(/Ensalada: antes \$\s5\.000, ahora \$\s7\.000/)
    expect(items[1]).toHaveTextContent(/Bife de chorizo: antes \$\s12\.000, ahora \$\s11\.000/)
  })

  it('sin líneas informadas no dibuja una lista vacía', () => {
    renderNotice({ lines: [] })
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('"Aceptar y enviar" acepta el total nuevo y "Revisar pedido" lo descarta, sin enviar nada por su cuenta', async () => {
    const { onAccept, onReview } = renderNotice()

    await userEvent.click(screen.getByRole('button', { name: /Aceptar y enviar/ }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    expect(onReview).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
    expect(onReview).toHaveBeenCalledTimes(1)
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it('el botón de aceptar muestra el total nuevo: el cliente sabe qué acepta', () => {
    renderNotice({ newTotalCents: 1750000 })
    expect(screen.getByRole('button', { name: /Aceptar y enviar/ })).toHaveTextContent(/\$\s17\.500/)
  })

  it('al aparecer lleva el foco al aviso (el botón "Enviar" que tenía el foco desaparece)', () => {
    renderNotice()
    expect(screen.getByRole('alert')).toHaveFocus()
  })

  it('en inglés', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderNotice()
    expect(screen.getByRole('alert')).toHaveTextContent('The total changed')
    expect(screen.getByRole('alert')).toHaveTextContent(/Before ARS\s10,000, now ARS\s14,000\./)
    expect(screen.getByRole('button', { name: /Accept and send/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review order' })).toBeInTheDocument()
  })

  it('los botones miden al menos 44 px de alto y no tiene violaciones de accesibilidad', async () => {
    const { container } = renderNotice()
    expect(screen.getByRole('button', { name: 'Revisar pedido' })).toHaveClass('min-h-12')
    await expectNoA11yViolations(container)
  })
})
