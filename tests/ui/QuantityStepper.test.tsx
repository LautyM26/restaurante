import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LANG_STORAGE_KEY } from '../../src/i18n/I18nContext'
import { QuantityStepper } from '../../src/ui/QuantityStepper'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

function Controlled({ initial = 1, onRemove }: { initial?: number; onRemove?: () => void }) {
  const [value, setValue] = useState(initial)
  return <QuantityStepper value={value} onChange={setValue} onRemove={onRemove} />
}

const renderStepper = (initial?: number, onRemove?: () => void) =>
  renderWithProviders(<Controlled initial={initial} onRemove={onRemove} />, { i18n: true })

const decrease = () => screen.getByRole('button', { name: 'Disminuir cantidad' })
const increase = () => screen.getByRole('button', { name: 'Aumentar cantidad' })

describe('QuantityStepper: cantidad de 1 a 20 (RF20, CL10)', () => {
  beforeEach(() => window.localStorage.clear())

  it('es un grupo con nombre, muestra la cantidad y tiene dos botones con nombre accesible', () => {
    renderStepper(3)
    const group = screen.getByRole('group', { name: 'Cantidad' })
    expect(within(group).getByRole('status')).toHaveTextContent('3')
    expect(decrease()).toBeInTheDocument()
    expect(increase()).toBeInTheDocument()
  })

  it('suma y resta de a una unidad', async () => {
    renderStepper(2)
    await userEvent.click(increase())
    await userEvent.click(increase())
    expect(screen.getByRole('status')).toHaveTextContent('4')
    await userEvent.click(decrease())
    expect(screen.getByRole('status')).toHaveTextContent('3')
  })

  it('el mínimo es 1: en 1 restar está deshabilitado (la cantidad nunca llega a 0)', async () => {
    renderStepper(1)
    expect(decrease()).toBeDisabled()
    await userEvent.click(decrease())
    expect(screen.getByRole('status')).toHaveTextContent('1')
  })

  it('el máximo es 20: en 20 sumar está deshabilitado y en 19 todavía se puede', async () => {
    renderStepper(19)
    expect(increase()).toBeEnabled()
    await userEvent.click(increase())
    expect(screen.getByRole('status')).toHaveTextContent('20')
    expect(increase()).toBeDisabled()
    await userEvent.click(increase())
    expect(screen.getByRole('status')).toHaveTextContent('20')
  })

  it('los dos botones miden 44 × 44 px', () => {
    renderStepper(5)
    for (const button of [decrease(), increase()]) expect(button).toHaveClass('size-11')
  })

  describe('modo "Quitar" (resumen del pedido)', () => {
    it('con onRemove y cantidad 1, restar se reemplaza por "Quitar" y avisa', async () => {
      const onRemove = vi.fn()
      renderStepper(1, onRemove)

      expect(screen.queryByRole('button', { name: 'Disminuir cantidad' })).not.toBeInTheDocument()
      const remove = screen.getByRole('button', { name: 'Quitar' })
      expect(remove).toBeEnabled()
      await userEvent.click(remove)
      expect(onRemove).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('status')).toHaveTextContent('1') // nunca baja a 0
    })

    it('con cantidad mayor que 1 sigue siendo restar', async () => {
      const onRemove = vi.fn()
      renderStepper(2, onRemove)

      expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
      await userEvent.click(decrease())
      expect(onRemove).not.toHaveBeenCalled()
      // al llegar a 1 aparece "Quitar"
      expect(screen.getByRole('button', { name: 'Quitar' })).toBeInTheDocument()
    })

    it('sin onRemove, en 1 no hay "Quitar" (ficha del plato)', () => {
      renderStepper(1)
      expect(screen.queryByRole('button', { name: 'Quitar' })).not.toBeInTheDocument()
    })
  })

  it('con `label` el grupo lleva su propio nombre (varias líneas del resumen no repiten "Cantidad")', () => {
    renderWithProviders(
      <>
        <QuantityStepper value={2} onChange={() => {}} label="Cantidad: Ensalada" />
        <QuantityStepper value={1} onChange={() => {}} label="Cantidad: Bife" />
      </>,
      { i18n: true },
    )
    expect(screen.getByRole('group', { name: 'Cantidad: Ensalada' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Cantidad: Bife' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Cantidad' })).not.toBeInTheDocument()
  })

  it('los nombres cambian de idioma', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderStepper(2)
    expect(screen.getByRole('group', { name: 'Quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease quantity' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeInTheDocument()
  })

  it('no tiene violaciones de accesibilidad (normal, en 1, en 20 y con "Quitar")', async () => {
    const view = renderStepper(5)
    await expectNoA11yViolations(view.container)
    view.unmount()
    for (const [initial, onRemove] of [[1, undefined], [20, undefined], [1, () => {}]] as const) {
      const other = renderStepper(initial, onRemove)
      await expectNoA11yViolations(other.container)
      other.unmount()
    }
  })
})
