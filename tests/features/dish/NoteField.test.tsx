import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { NoteField } from '../../../src/features/dish/NoteField'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

function Controlled({ max = 140, initial = '' }: { max?: number; initial?: string }) {
  const [value, setValue] = useState(initial)
  return <NoteField label="dish.note.label" max={max} value={value} onChange={setValue} />
}

const renderNote = (props: { max?: number; initial?: string } = {}) =>
  renderWithProviders(<Controlled {...props} />, { i18n: true })

const box = () => screen.getByRole('textbox', { name: 'Nota para la cocina' }) as HTMLTextAreaElement

describe('NoteField: nota con límite en caracteres visibles (RF20)', () => {
  beforeEach(() => window.localStorage.clear())

  it('tiene una etiqueta visible, un ejemplo y un contador "0 de 140"', () => {
    renderNote()
    expect(box()).toHaveAttribute('placeholder', 'Ej.: sin cebolla')
    expect(box()).toHaveAccessibleDescription('0 de 140')
  })

  it('el contador sigue lo que se escribe', async () => {
    renderNote()
    await userEvent.type(box(), 'sin sal')
    expect(box()).toHaveValue('sin sal')
    expect(box()).toHaveAccessibleDescription('7 de 140')
  })

  it('un emoji compuesto cuenta como un solo carácter', async () => {
    renderNote()
    fireEvent.change(box(), { target: { value: 'ok 👨‍👩‍👧‍👦' } })
    expect(box()).toHaveAccessibleDescription('4 de 140')
  })

  it('el tope es 140: lo que sobra al pegar se corta', () => {
    renderNote()
    fireEvent.change(box(), { target: { value: 'x'.repeat(300) } })
    expect(box()).toHaveValue('x'.repeat(140))
    expect(box()).toHaveAccessibleDescription('140 de 140')
  })

  it('al cortar no parte un emoji por la mitad', () => {
    renderNote()
    fireEvent.change(box(), { target: { value: `${'a'.repeat(139)}👨‍👩‍👧‍👦👨‍👩‍👧‍👦` } })
    expect(box()).toHaveValue(`${'a'.repeat(139)}👨‍👩‍👧‍👦`)
    expect(box()).toHaveAccessibleDescription('140 de 140')
  })

  it('el tope es configurable (nota general: 200)', () => {
    renderNote({ max: 200 })
    fireEvent.change(box(), { target: { value: 'y'.repeat(250) } })
    expect(box()).toHaveValue('y'.repeat(200))
    expect(box()).toHaveAccessibleDescription('200 de 200')
  })

  it('un valor inicial más largo que el tope se muestra recortado', () => {
    renderNote({ initial: 'z'.repeat(150) })
    expect(box()).toHaveValue('z'.repeat(140))
  })

  it('cambia de idioma sin perder lo escrito', async () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderNote({ initial: 'no onion' })
    const english = screen.getByRole('textbox', { name: 'Note for the kitchen' })
    expect(english).toHaveValue('no onion')
    expect(english).toHaveAccessibleDescription('8 of 140')
  })

  it('no tiene violaciones de accesibilidad', async () => {
    const { container } = renderNote({ initial: 'sin sal' })
    await expectNoA11yViolations(container)
  })
})
