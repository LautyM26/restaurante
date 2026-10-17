import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider, LANG_STORAGE_KEY, useI18n } from '../../src/i18n/I18nContext'
import { renderWithProviders } from '../utils'

// Componente de prueba: expone todo lo que ofrece useI18n() y botones para cambiar de idioma.
function Probe() {
  const { lang, setLang, t, formatPrice, formatTime, localize } = useI18n()
  return (
    <div>
      <p data-testid="lang">{lang}</p>
      <p data-testid="badge">{t('table.badge', { n: 12 })}</p>
      <p data-testid="plural1">{t('dish.required', { count: 1 })}</p>
      <p data-testid="plural3">{t('dish.required', { count: 3 })}</p>
      <p data-testid="price">{formatPrice(1_250_000)}</p>
      <p data-testid="time">{formatTime(new Date(2026, 9, 12, 14, 5).toISOString())}</p>
      <p data-testid="dish">{localize({ es: 'Milanesa', en: 'Breaded cutlet' })}</p>
      <p data-testid="dishNoEn">{localize({ es: 'Flan casero' })}</p>
      <button onClick={() => setLang('en')}>to-en</button>
      <button onClick={() => setLang('es')}>to-es</button>
    </div>
  )
}

const renderProbe = () =>
  renderWithProviders(
    <I18nProvider>
      <Probe />
    </I18nProvider>,
  )

const text = (id: string) => screen.getByTestId(id).textContent?.replace(/\s/g, ' ')

describe('I18nProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.lang = ''
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('arranca en español y sincroniza <html lang>', () => {
    renderProbe()
    expect(text('lang')).toBe('es')
    expect(text('badge')).toBe('Mesa 12')
    expect(document.documentElement.lang).toBe('es')
  })

  it('no detecta el idioma del navegador: sigue en español aunque el navegador esté en inglés', () => {
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('en-US')
    renderProbe()
    expect(text('lang')).toBe('es')
  })

  it('al cambiar a inglés traduce la interfaz, formatea según el idioma y actualiza <html lang>', async () => {
    renderProbe()
    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))

    expect(text('lang')).toBe('en')
    expect(text('badge')).toBe('Table 12')
    expect(text('price')).toBe('ARS 12,500')
    expect(text('time')).toBe('02:05 PM')
    expect(text('dish')).toBe('Breaded cutlet')
    expect(document.documentElement.lang).toBe('en')
  })

  it('vuelve a español con los mismos valores de antes', async () => {
    renderProbe()
    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))
    await userEvent.click(screen.getByRole('button', { name: 'to-es' }))

    expect(text('badge')).toBe('Mesa 12')
    expect(text('price')).toBe('$ 12.500')
    expect(text('time')).toBe('14:05')
    expect(document.documentElement.lang).toBe('es')
  })

  it('elige la forma plural según la cantidad y el idioma', async () => {
    renderProbe()
    expect(text('plural1')).toBe('Elegí 1 opción')
    expect(text('plural3')).toBe('Elegí 3 opciones')

    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))
    expect(text('plural1')).toBe('Choose 1 option')
    expect(text('plural3')).toBe('Choose 3 options')
  })

  it('muestra en español el texto de la carta sin traducción al inglés (RF35)', async () => {
    renderProbe()
    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))
    expect(text('dishNoEn')).toBe('Flan casero')
  })

  it('recuerda el idioma elegido: se guarda y una "recarga" arranca en inglés', async () => {
    const first = renderProbe()
    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBe('en')

    first.unmount()
    document.documentElement.lang = ''
    renderProbe()
    expect(text('lang')).toBe('en')
    expect(text('badge')).toBe('Table 12')
    expect(document.documentElement.lang).toBe('en')
  })

  it('ignora un valor guardado inválido y usa español', () => {
    window.localStorage.setItem(LANG_STORAGE_KEY, 'fr')
    renderProbe()
    expect(text('lang')).toBe('es')
  })

  it('no escribe nada en el almacenamiento hasta que el cliente elige un idioma', () => {
    renderProbe()
    expect(window.localStorage.getItem(LANG_STORAGE_KEY)).toBeNull()
  })

  it('con el almacenamiento bloqueado sigue funcionando, sin recordar (RNF8, CL23)', async () => {
    const blocked = () => {
      throw new DOMException('Almacenamiento bloqueado', 'SecurityError')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked)

    renderProbe()
    expect(text('lang')).toBe('es')

    await userEvent.click(screen.getByRole('button', { name: 'to-en' }))
    expect(text('lang')).toBe('en')
    expect(text('badge')).toBe('Table 12')
    expect(document.documentElement.lang).toBe('en')
  })
})

describe('useI18n', () => {
  it('lanza un error claro si se usa fuera de <I18nProvider>', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderWithProviders(<Probe />)).toThrow(/I18nProvider/)
    vi.restoreAllMocks()
  })

  it('t solo acepta claves existentes (verificado por tsc en npm run build)', () => {
    function WrongKey() {
      const { t } = useI18n()
      // @ts-expect-error la clave no existe en el diccionario
      return <p>{t('clave.inexistente')}</p>
    }
    renderWithProviders(
      <I18nProvider>
        <WrongKey />
      </I18nProvider>,
    )
    // En runtime, una clave desconocida se muestra tal cual en lugar de romper la pantalla.
    expect(screen.getByText('clave.inexistente')).toBeInTheDocument()
  })
})
