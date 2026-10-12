import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { TableNotice } from '../../../src/features/menu/TableNotice'
import { LANG_STORAGE_KEY } from '../../../src/i18n/I18nContext'
import { ServiceError } from '../../../src/services/contracts'
import { createTestServices } from '../../fixtures/services'
import { expectNoA11yViolations, renderWithProviders } from '../../utils'

const NOTICE_ES = 'Para pedir, escaneá el código QR de tu mesa o pedile ayuda al personal.'
const NOTICE_EN = 'To order, scan the QR code on your table or ask our staff.'

type GetTable = Parameters<typeof createTestServices>[0]

const renderNotice = (url: string, getTable?: GetTable) => {
  const services = createTestServices(getTable)
  return { services, ...renderWithProviders(<TableNotice />, { url, services, i18n: true, table: true }) }
}

describe('TableNotice (RF1, RF2, RF3, RF41)', () => {
  beforeEach(() => window.localStorage.clear())

  describe('sin mesa válida: solo lectura (RF2)', () => {
    it('sin ?mesa explica que hay que escanear el QR o pedir ayuda, sin botón de reintento', () => {
      renderNotice('/')
      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it.each(['/?mesa=', '/?mesa=abc', '/?mesa=0', '/?mesa=12.5', '/?mesa=1000'])('%s muestra el mismo aviso', (url) => {
      renderNotice(url)
      expect(screen.getByText(NOTICE_ES)).toBeInTheDocument()
    })

    it('una mesa que el restaurante no tiene (?mesa=50) muestra el aviso tras verificarla', async () => {
      const { services } = renderNotice('/?mesa=50', async () => null)
      expect(await screen.findByText(NOTICE_ES)).toBeInTheDocument()
      expect(services.menuService.getTable).toHaveBeenCalledWith(50)
    })
  })

  describe('verificando la mesa (RF3)', () => {
    it('anuncia "Verificando tu mesa" como estado, mientras espera la respuesta', async () => {
      renderNotice('/?mesa=12', () => new Promise(() => {}))
      expect(screen.getByRole('status')).toHaveTextContent('Verificando tu mesa')
      expect(screen.queryByText(NOTICE_ES)).not.toBeInTheDocument()
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('mesa válida', () => {
    it('no muestra nada cuando la mesa existe', async () => {
      const { container, services } = renderNotice('/?mesa=12')
      await waitFor(() => expect(services.menuService.getTable).toHaveBeenCalled())
      await waitFor(() => expect(screen.queryByText('Verificando tu mesa')).not.toBeInTheDocument())
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('no se pudo verificar (RF41)', () => {
    const failing = async () => {
      throw new ServiceError('NETWORK', 'sin red')
    }

    it('avisa del problema de conexión y ofrece "Reintentar"', async () => {
      renderNotice('/?mesa=12', failing)
      expect(await screen.findByText('No pudimos verificar tu mesa. Revisá tu conexión.')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    })

    it('"Reintentar" vuelve a verificar y, si ahora responde, el aviso desaparece', async () => {
      let calls = 0
      const { services, container } = renderNotice('/?mesa=12', async (id) => {
        if (++calls === 1) throw new ServiceError('NETWORK', 'sin red')
        return { id }
      })
      await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

      await waitFor(() => expect(container).toBeEmptyDOMElement())
      expect(services.menuService.getTable).toHaveBeenCalledTimes(2)
    })

    it('si vuelve la conexión sin tocar nada, se verifica solo y el aviso desaparece', async () => {
      let calls = 0
      const { container } = renderNotice('/?mesa=12', async (id) => {
        if (++calls === 1) throw new ServiceError('NETWORK', 'sin red')
        return { id }
      })
      await screen.findByRole('button', { name: 'Reintentar' })

      act(() => void window.dispatchEvent(new Event('online')))

      await waitFor(() => expect(container).toBeEmptyDOMElement())
    })

    it('el botón de reintento mide al menos 44 px (min-h-11)', async () => {
      renderNotice('/?mesa=12', failing)
      expect(await screen.findByRole('button', { name: 'Reintentar' })).toHaveClass('min-h-11')
    })
  })

  describe('idiomas', () => {
    it('muestra los textos en inglés cuando ese es el idioma guardado', async () => {
      window.localStorage.setItem(LANG_STORAGE_KEY, 'en')
      const { unmount } = renderNotice('/')
      expect(screen.getByText(NOTICE_EN)).toBeInTheDocument()
      unmount()

      renderNotice('/?mesa=12', async () => {
        throw new ServiceError('NETWORK', 'sin red')
      })
      expect(await screen.findByText("We couldn't verify your table. Check your connection.")).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })
  })

  describe('accesibilidad', () => {
    it('sin violaciones en missing, checking y unverified', async () => {
      const missing = renderNotice('/')
      await expectNoA11yViolations(missing.container)
      missing.unmount()

      const checking = renderNotice('/?mesa=12', () => new Promise(() => {}))
      await expectNoA11yViolations(checking.container)
      checking.unmount()

      const unverified = renderNotice('/?mesa=12', async () => {
        throw new ServiceError('NETWORK', 'sin red')
      })
      await screen.findByRole('button', { name: 'Reintentar' })
      await expectNoA11yViolations(unverified.container)
    })
  })
})
