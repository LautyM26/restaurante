import { useState } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from '../../src/ui/SegmentedControl'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

const options = [
  { value: 'a', label: 'AA', ariaLabel: 'Opción A' },
  { value: 'b', label: 'BB', ariaLabel: 'Opción B', lang: 'en' },
  { value: 'c', label: 'CC', ariaLabel: 'Opción C' },
]

// Versión con estado, como la usan las pantallas reales.
function Stateful({ onChange }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('a')
  return (
    <SegmentedControl
      label="Letra"
      value={value}
      options={options}
      onChange={(next) => {
        setValue(next)
        onChange?.(next)
      }}
    />
  )
}

describe('SegmentedControl', () => {
  it('es un radiogroup con nombre y un radio por opción, con la seleccionada marcada', () => {
    renderWithProviders(<SegmentedControl label="Letra" value="b" options={options} onChange={() => {}} />)

    expect(screen.getByRole('radiogroup', { name: 'Letra' })).toBeInTheDocument()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Opción B' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Opción A' })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: 'Opción C' })).not.toBeChecked()
  })

  it('muestra el texto visible de cada opción', () => {
    renderWithProviders(<SegmentedControl label="Letra" value="a" options={options} onChange={() => {}} />)
    expect(screen.getByText('AA')).toBeVisible()
    expect(screen.getByText('BB')).toBeVisible()
  })

  it('al tocar otra opción llama a onChange con su valor', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Stateful onChange={onChange} />)

    await userEvent.click(screen.getByRole('radio', { name: 'Opción C' }))
    expect(onChange).toHaveBeenCalledExactlyOnceWith('c')
    expect(screen.getByRole('radio', { name: 'Opción C' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Opción A' })).not.toBeChecked()
  })

  it('tocar la opción ya seleccionada no dispara onChange', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Stateful onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Opción A' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('es controlado: si el padre no cambia el valor, la selección no se mueve', async () => {
    renderWithProviders(<SegmentedControl label="Letra" value="a" options={options} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('radio', { name: 'Opción B' }))
    expect(screen.getByRole('radio', { name: 'Opción A' })).toBeChecked()
  })

  it('se opera con el teclado: Tab entra en la opción activa y las flechas cambian la selección', async () => {
    const onChange = vi.fn()
    renderWithProviders(<Stateful onChange={onChange} />)

    await userEvent.tab()
    expect(screen.getByRole('radio', { name: 'Opción A' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'Opción B' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Opción B' })).toHaveFocus()
    expect(onChange).toHaveBeenLastCalledWith('b')

    await userEvent.keyboard('{ArrowLeft}')
    expect(screen.getByRole('radio', { name: 'Opción A' })).toBeChecked()
  })

  it('cada opción es un objetivo táctil de al menos 44 × 44 px', () => {
    renderWithProviders(<SegmentedControl label="Letra" value="a" options={options} onChange={() => {}} />)
    for (const radio of screen.getAllByRole('radio')) {
      const target = radio.closest('label')
      expect(target).toHaveClass('min-h-11', 'min-w-11')
    }
  })

  it('muestra el foco del teclado en el elemento visible, no en la entrada oculta', () => {
    renderWithProviders(<SegmentedControl label="Letra" value="a" options={options} onChange={() => {}} />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toHaveClass('peer', 'sr-only')
      expect(radio.nextElementSibling).toHaveClass('peer-focus-visible:outline-2')
    }
  })

  it('declara el idioma de la opción cuando se indica', () => {
    renderWithProviders(<SegmentedControl label="Letra" value="a" options={options} onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Opción B' }).closest('label')).toHaveAttribute('lang', 'en')
    expect(screen.getByRole('radio', { name: 'Opción A' }).closest('label')).not.toHaveAttribute('lang')
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderWithProviders(<Stateful />)
    await expectNoA11yViolations(container)
  })
})
