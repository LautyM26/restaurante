import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { LanguageToggle } from '../../../src/features/layout/LanguageToggle'
import { I18nProvider, LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const renderToggle = () =>
  renderWithProviders(
    <I18nProvider>
      <LanguageToggle />
    </I18nProvider>,
  )

describe('LanguageToggle', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })

  it('es un radiogroup "Idioma" con Español e English, y Español seleccionado por defecto', () => {
    renderToggle()

    expect(screen.getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'English' })).not.toBeChecked()
  })

  it('muestra los códigos cortos ES y EN para que quepan en la barra', () => {
    renderToggle()
    expect(screen.getByText('ES')).toBeVisible()
    expect(screen.getByText('EN')).toBeVisible()
  })

  it('al elegir English cambia la selección, el nombre del grupo, <html lang> y se recuerda', async () => {
    renderToggle()
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))

    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'Español' })).not.toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Language' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('en')
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en')
  })

  it('vuelve a Español y el grupo recupera su nombre en español', async () => {
    renderToggle()
    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    await userEvent.click(screen.getByRole('radio', { name: 'Español' }))

    expect(screen.getByRole('radio', { name: 'Español' })).toBeChecked()
    expect(screen.getByRole('radiogroup', { name: 'Idioma' })).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('es')
  })

  it('arranca con English seleccionado si ese idioma estaba guardado', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
    renderToggle()
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
  })

  it('cada opción es un objetivo táctil de 44 px por clase (min-h-11 / min-w-11)', () => {
    renderToggle()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio.closest('label')).toHaveClass('min-h-11', 'min-w-11')
    }
  })

  it('se opera con el teclado', async () => {
    renderToggle()
    await userEvent.tab()
    expect(screen.getByRole('radio', { name: 'Español' })).toHaveFocus()

    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked()
    expect(document.documentElement.lang).toBe('en')
  })

  it('declara el idioma de cada opción para que el lector de pantalla la pronuncie bien', () => {
    renderToggle()
    expect(screen.getByRole('radio', { name: 'Español' }).closest('label')).toHaveAttribute('lang', 'es')
    expect(screen.getByRole('radio', { name: 'English' }).closest('label')).toHaveAttribute('lang', 'en')
  })

  it('no tiene violaciones de accesibilidad, en español ni en inglés', async () => {
    const { container } = renderToggle()
    await expectNoA11yViolations(container)

    await userEvent.click(screen.getByRole('radio', { name: 'English' }))
    await expectNoA11yViolations(container)
  })
})
