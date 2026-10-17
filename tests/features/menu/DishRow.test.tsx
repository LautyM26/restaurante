import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DishRow } from '../../../src/features/menu/DishRow'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { formatPrice as rawFormatPrice } from '../../../src/i18n/format'
import type { Dish } from '../../../src/domain/types'
import { burger, makeDish, makeGroup, makeOption, soldOut, trapped } from '../../fixtures/menu'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

// Intl separa el signo y el número con un espacio de no ruptura; Testing Library lo normaliza a un espacio común.
const formatPrice = (cents: number, lang: 'es' | 'en') => rawFormatPrice(cents, lang).replaceAll(' ', ' ')

const milanesa = makeDish('milanesa', {
  name: { es: 'Milanesa napolitana', en: 'Napolitan cutlet' },
  description: { es: 'Con jamón, salsa y mozzarella gratinada.', en: 'With ham, tomato sauce and melted mozzarella.' },
  priceCents: 1850000,
  tags: ['spicy', 'gluten_free'],
})

function renderRow(dish: Dish, onOpen = vi.fn()) {
  const view = renderWithProviders(
    <ul>
      <DishRow dish={dish} visual="main" onOpen={onOpen} />
    </ul>,
    { i18n: true },
  )
  return { onOpen, ...view }
}

describe('DishRow: fila de un plato (RF7, RF13, RF34)', () => {
  beforeEach(() => window.localStorage.clear())

  describe('plato pedible', () => {
    it('muestra nombre, descripción, precio formateado y etiquetas con su texto', () => {
      renderRow(milanesa)
      const row = screen.getByRole('button', { name: 'Milanesa napolitana' })

      expect(row).toHaveAccessibleDescription(/Con jamón, salsa y mozzarella gratinada\./)
      expect(within(row).getByText(formatPrice(1850000, 'es'))).toBeInTheDocument()
      expect(within(row).getByText('Picante')).toBeInTheDocument()
      expect(within(row).getByText('Sin TACC')).toBeInTheDocument()
    })

    it('el precio y las etiquetas también forman parte de la descripción accesible', () => {
      renderRow(milanesa)
      const description = screen.getByRole('button', { name: 'Milanesa napolitana' })
      // El espacio entre el signo y el número puede ser de no ruptura: se acepta cualquier espacio.
      expect(description).toHaveAccessibleDescription(/\$\s18\.500/)
      // Las etiquetas se leen separadas, no pegadas ("PicanteSin TACC").
      expect(description).toHaveAccessibleDescription(/Picante Sin TACC/)
    })

    it('las cuatro etiquetas dietarias tienen su texto', () => {
      renderRow(makeDish('tags', { name: { es: 'Con todo' }, tags: ['vegetarian', 'vegan', 'gluten_free', 'spicy'] }))
      for (const label of ['Vegetariano', 'Vegano', 'Sin TACC', 'Picante']) {
        expect(screen.getByText(label)).toBeInTheDocument()
      }
    })

    it('sin etiquetas no dibuja ninguna', () => {
      renderRow(makeDish('plain', { name: { es: 'Simple' }, tags: [] }))
      expect(screen.queryByText(/Vegetariano|Vegano|Sin TACC|Picante/)).not.toBeInTheDocument()
    })

    it('la fila entera es un botón habilitado y tocarla avisa con el plato', async () => {
      const { onOpen } = renderRow(milanesa)
      const row = screen.getByRole('button', { name: 'Milanesa napolitana' })
      expect(row).toBeEnabled()
      expect(row.tagName).toBe('BUTTON')
      expect(row).toHaveAttribute('type', 'button')

      await userEvent.click(row)
      expect(onOpen).toHaveBeenCalledTimes(1)
      expect(onOpen).toHaveBeenCalledWith(milanesa)
    })

    it('se puede abrir con el teclado', async () => {
      const { onOpen } = renderRow(milanesa)
      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'Milanesa napolitana' })).toHaveFocus()
      await userEvent.keyboard('{Enter}')
      expect(onOpen).toHaveBeenCalledTimes(1)
    })

    it('un plato pedible no dice "Agotado"', () => {
      renderRow(burger)
      expect(screen.queryByText('Agotado')).not.toBeInTheDocument()
    })
  })

  describe('plato no pedible: "Agotado" (RF13, CL5, CL32)', () => {
    it('un plato no disponible muestra "Agotado", queda deshabilitado y no abre', async () => {
      const { onOpen } = renderRow(soldOut)
      const row = screen.getByRole('button', { name: 'sold_out' })

      expect(within(row).getByText('Agotado')).toBeInTheDocument()
      expect(row).toBeDisabled()
      await userEvent.click(row)
      expect(onOpen).not.toHaveBeenCalled()
    })

    it('P4: disponible pero con un grupo obligatorio sin opciones suficientes también es "Agotado"', async () => {
      const { onOpen } = renderRow(trapped)
      const row = screen.getByRole('button', { name: 'trapped' })

      expect(trapped.available).toBe(true)
      expect(within(row).getByText('Agotado')).toBeInTheDocument()
      expect(row).toBeDisabled()
      await userEvent.click(row)
      expect(onOpen).not.toHaveBeenCalled()
    })

    it('un grupo obligatorio con suficientes opciones disponibles sigue siendo pedible', () => {
      const dish = makeDish('ok', {
        optionGroups: [makeGroup('sauce', { min: 1, max: 1, options: [makeOption('bbq', { available: false }), makeOption('mayo')] })],
      })
      renderRow(dish)
      expect(screen.getByRole('button', { name: 'ok' })).toBeEnabled()
      expect(screen.queryByText('Agotado')).not.toBeInTheDocument()
    })

    it('un grupo opcional sin opciones disponibles no agota el plato', () => {
      const dish = makeDish('optional', {
        optionGroups: [makeGroup('extras', { min: 0, max: 2, options: [makeOption('x', { available: false })] })],
      })
      renderRow(dish)
      expect(screen.getByRole('button', { name: 'optional' })).toBeEnabled()
    })

    it('"Agotado" es parte de la descripción accesible para el lector de pantalla', () => {
      renderRow(soldOut)
      expect(screen.getByRole('button', { name: 'sold_out' })).toHaveAccessibleDescription(/Agotado/)
    })

    it('un plato agotado sigue mostrando su precio y su descripción', () => {
      renderRow(makeDish('gone', { available: false, priceCents: 990000, description: { es: 'Ya no queda.' } }))
      const row = screen.getByRole('button', { name: 'gone' })
      expect(within(row).getByText(formatPrice(990000, 'es'))).toBeInTheDocument()
      expect(within(row).getByText('Ya no queda.')).toBeInTheDocument()
    })
  })

  describe('idioma (RF34, RF35)', () => {
    it('en inglés traduce plato, descripción, etiquetas, precio y "Sold out"', () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderRow({ ...milanesa, available: false })
      const row = screen.getByRole('button', { name: 'Napolitan cutlet' })

      expect(within(row).getByText('With ham, tomato sauce and melted mozzarella.')).toBeInTheDocument()
      expect(within(row).getByText('Spicy')).toBeInTheDocument()
      expect(within(row).getByText('Gluten free')).toBeInTheDocument()
      expect(within(row).getByText('Sold out')).toBeInTheDocument()
      expect(within(row).getByText(formatPrice(1850000, 'en'))).toBeInTheDocument()
    })

    it('si falta la traducción al inglés usa el español (fallback)', () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      renderRow(makeDish('empanadas', { name: { es: 'Empanadas criollas' }, description: { es: 'Fritas, de carne cortada a cuchillo.' } }))
      const row = screen.getByRole('button', { name: 'Empanadas criollas' })
      expect(within(row).getByText('Fritas, de carne cortada a cuchillo.')).toBeInTheDocument()
    })
  })

  describe('imagen y estructura', () => {
    it('con imageUrl muestra la foto; sin ella, el degradado con ícono', () => {
      const { container, unmount } = renderRow({ ...milanesa, imageUrl: 'https://example.com/m.jpg' })
      expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/m.jpg')
      unmount()

      const plain = renderRow(milanesa)
      expect(plain.container.querySelector('img')).not.toBeInTheDocument()
      expect(plain.container.querySelector('svg')).toBeInTheDocument()
    })

    it('es un elemento de lista con una línea separadora (sin caja)', () => {
      renderRow(milanesa)
      const item = screen.getByRole('listitem')
      expect(item).toHaveClass('border-b')
      expect(item.className).not.toMatch(/\bshadow/)
    })

    it('un nombre larguísimo sin espacios no desborda la fila', () => {
      renderRow(makeDish('long', { name: { es: 'Superlongnombredeplatoquenotieneningunespacioentodasulongitudabsurda' } }))
      expect(screen.getByRole('button')).toHaveClass('min-w-0')
      expect(screen.getByText(/Superlongnombre/).className).toContain('break-words')
    })
  })

  it('sin violaciones de accesibilidad: plato pedible, agotado y con etiquetas', async () => {
    const { container } = renderWithProviders(
      <ul>
        <DishRow dish={milanesa} visual="main" onOpen={() => {}} />
        <DishRow dish={soldOut} visual="grill" onOpen={() => {}} />
        <DishRow dish={trapped} visual="pasta" onOpen={() => {}} />
      </ul>,
      { i18n: true },
    )
    await expectNoA11yViolations(container)
  })
})
