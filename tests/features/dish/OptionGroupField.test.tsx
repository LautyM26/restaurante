import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OptionGroupField } from '../../../src/features/dish/OptionGroupField'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import type { OptionGroup } from '../../../src/domain/types'
import { cookingGroup, extrasGroup, makeGroup, makeOption } from '../../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

/** Nombres legibles para los grupos de los fixtures. */
const named = (group: OptionGroup, es: string, en?: string): OptionGroup => ({
  ...group,
  name: { es, en },
  options: group.options.map((o) => ({ ...o, name: { es: o.name.es } })),
})

function Controlled({
  group,
  initial = [],
  onToggle = () => {},
}: {
  group: OptionGroup
  initial?: string[]
  onToggle?: (optionId: string) => void
}) {
  const [selected, setSelected] = useState(initial)
  // Imita a toggleOption lo justo para ver el comportamiento visual del grupo.
  const toggle = (id: string) => {
    onToggle(id)
    setSelected((current) =>
      group.type === 'single' ? [id] : current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }
  return <OptionGroupField group={group} selected={selected} onToggle={toggle} messageId="msg-1" />
}

const renderGroup = (group: OptionGroup, initial?: string[], onToggle?: (id: string) => void) =>
  renderWithProviders(<Controlled group={group} initial={initial} onToggle={onToggle} />, { i18n: true })

const cooking = named(cookingGroup, 'Punto de cocción', 'Doneness')
const extras = named(extrasGroup, 'Extras')

describe('OptionGroupField: un grupo de opciones (RF15-RF17, CL6-CL8)', () => {
  beforeEach(() => window.localStorage.clear())

  describe('elección única (radios)', () => {
    it('es un grupo con el nombre del grupo y un radio por opción', () => {
      renderGroup(cooking)
      const group = screen.getByRole('group', { name: /Punto de cocción/ })
      expect(within(group).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual([
        'rare',
        'medium',
        'well_done',
      ])
    })

    it('marca como obligatorio el grupo con mínimo mayor que 0', () => {
      renderGroup(cooking)
      expect(screen.getByText('Obligatorio')).toBeInTheDocument()
    })

    it('elegir una opción llama a onToggle y reemplaza a la anterior', async () => {
      const onToggle = vi.fn()
      renderGroup(cooking, ['rare'], onToggle)

      expect(screen.getByRole('radio', { name: /rare/ })).toBeChecked()
      await userEvent.click(screen.getByRole('radio', { name: /medium/ }))
      expect(onToggle).toHaveBeenCalledWith('medium')
      expect(screen.getByRole('radio', { name: /medium/ })).toBeChecked()
      expect(screen.getByRole('radio', { name: /rare/ })).not.toBeChecked()
    })

    it('una opción no disponible queda visible, deshabilitada y con la indicación (CL6)', async () => {
      const onToggle = vi.fn()
      renderGroup(cooking, [], onToggle)

      const unavailable = screen.getByRole('radio', { name: /well_done/ })
      expect(unavailable).toBeDisabled()
      expect(unavailable).toHaveAccessibleName(/No disponible/)
      await userEvent.click(unavailable)
      expect(onToggle).not.toHaveBeenCalled()
    })

    it('volver a tocar la opción elegida en un grupo opcional la deselecciona; en uno obligatorio no', async () => {
      const onToggle = vi.fn()
      const optional = makeGroup('side', {
        type: 'single',
        min: 0,
        max: 1,
        options: [makeOption('fries'), makeOption('salad')],
      })
      const { unmount } = renderGroup(optional, ['fries'], onToggle)
      await userEvent.click(screen.getByRole('radio', { name: /fries/ }))
      expect(onToggle).toHaveBeenCalledWith('fries')
      unmount()

      onToggle.mockClear()
      renderGroup(cooking, ['rare'], onToggle)
      await userEvent.click(screen.getByRole('radio', { name: /rare/ }))
      expect(onToggle).not.toHaveBeenCalled()
    })
  })

  describe('elección múltiple (casillas)', () => {
    it('muestra una casilla por opción, "Opcional" y el límite "Hasta 2"', () => {
      renderGroup(extras)
      const group = screen.getByRole('group', { name: /Extras/ })
      expect(within(group).getAllByRole('checkbox')).toHaveLength(3)
      expect(screen.getByText('Opcional')).toBeInTheDocument()
      expect(screen.getByText('Hasta 2')).toBeInTheDocument()
    })

    it('muestra el adicional de cada opción con costo, y nada en las gratis', () => {
      renderGroup(extras)
      expect(screen.getByRole('checkbox', { name: /cheese/ })).toHaveAccessibleName(/\+\$\s500/)
      expect(screen.getByRole('checkbox', { name: /bacon/ })).toHaveAccessibleName(/\+\$\s800/)
      expect(screen.getByRole('checkbox', { name: 'ketchup' })).toBeInTheDocument()
    })

    it('al llegar al máximo deshabilita las no elegidas y anuncia el límite junto al grupo (CL8)', async () => {
      renderGroup(extras)
      expect(screen.getByRole('status')).toBeEmptyDOMElement()

      await userEvent.click(screen.getByRole('checkbox', { name: 'ketchup' }))
      expect(screen.getByRole('checkbox', { name: /cheese/ })).toBeEnabled()
      await userEvent.click(screen.getByRole('checkbox', { name: /cheese/ }))

      expect(screen.getByRole('checkbox', { name: /bacon/ })).toBeDisabled()
      expect(screen.getByRole('checkbox', { name: 'ketchup' })).toBeEnabled()
      expect(screen.getByRole('checkbox', { name: /cheese/ })).toBeEnabled()
      expect(screen.getByRole('status')).toHaveTextContent('Podés elegir hasta 2')
    })

    it('al quitar una elegida se vuelven a habilitar y el aviso se va', async () => {
      renderGroup(extras, ['ketchup', 'cheese'])
      expect(screen.getByRole('checkbox', { name: /bacon/ })).toBeDisabled()

      await userEvent.click(screen.getByRole('checkbox', { name: 'ketchup' }))
      expect(screen.getByRole('checkbox', { name: /bacon/ })).toBeEnabled()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
    })

    it('una opción no disponible nunca se puede elegir, aunque haya lugar', () => {
      const group = makeGroup('toppings', {
        type: 'multiple',
        min: 0,
        max: 3,
        options: [makeOption('ham'), makeOption('truffle', { available: false })],
      })
      renderGroup(group)
      expect(screen.getByRole('checkbox', { name: /truffle/ })).toBeDisabled()
      expect(screen.getByRole('checkbox', { name: /ham/ })).toBeEnabled()
    })
  })

  describe('mensaje de obligatoriedad (RF16, CL7)', () => {
    it('sin elegir en un grupo obligatorio dice cuántas faltan, con el id recibido para aria-describedby', () => {
      renderGroup(cooking)
      const message = document.getElementById('msg-1')!
      expect(message).toHaveTextContent('Elegí 1 opción')
    })

    it('usa el plural con mínimo mayor que 1: "Elegí 2 opciones" y luego "Elegí 1 opción"', async () => {
      const pair = makeGroup('flavors', {
        type: 'multiple',
        min: 2,
        max: 3,
        options: [makeOption('a'), makeOption('b'), makeOption('c')],
      })
      renderGroup(pair)
      expect(document.getElementById('msg-1')).toHaveTextContent('Elegí 2 opciones')

      await userEvent.click(screen.getByRole('checkbox', { name: 'a' }))
      expect(document.getElementById('msg-1')).toHaveTextContent('Elegí 1 opción')
      expect(document.getElementById('msg-1')).not.toHaveTextContent('opciones')
    })

    it('al llegar al mínimo el mensaje desaparece', async () => {
      renderGroup(cooking)
      await userEvent.click(screen.getByRole('radio', { name: /rare/ }))
      expect(document.getElementById('msg-1')).toBeNull()
    })

    it('un grupo opcional nunca muestra el mensaje', () => {
      renderGroup(extras)
      expect(document.getElementById('msg-1')).toBeNull()
    })
  })

  it('cambia de idioma: nombre del grupo, etiquetas y mensajes', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderGroup(cooking)
    expect(screen.getByRole('group', { name: /Doneness/ })).toBeInTheDocument()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Unavailable/ })).toBeDisabled()
    expect(document.getElementById('msg-1')).toHaveTextContent('Choose 1 option')
  })

  it('no tiene violaciones de accesibilidad (radios y casillas, con y sin selección)', async () => {
    for (const [group, initial] of [
      [cooking, undefined],
      [cooking, ['medium']],
      [extras, undefined],
      [extras, ['ketchup', 'cheese']],
    ] as const) {
      const { container, unmount } = renderGroup(group, initial ? [...initial] : undefined)
      await expectNoA11yViolations(container)
      unmount()
    }
  })
})
