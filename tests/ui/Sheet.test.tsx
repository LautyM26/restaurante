import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../src/i18n/I18nContext'
import { Sheet, SheetBody, SheetFooter, shouldCloseOnDrag } from '../../src/ui/Sheet'
import { expectNoA11yViolations, renderWithProviders } from '../utils'

function Harness({ onClosed = () => {} }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir ficha
      </button>
      <p>Contenido de la página</p>
      <Sheet
        open={open}
        title="Hamburguesa"
        onClose={() => {
          setOpen(false)
          onClosed()
        }}
      >
        <SheetBody>
          <button type="button">Primera opción</button>
        </SheetBody>
        <SheetFooter>
          <button type="button">Agregar</button>
        </SheetFooter>
      </Sheet>
    </>
  )
}

const renderHarness = (onClosed?: () => void) =>
  renderWithProviders(<Harness onClosed={onClosed} />, { i18n: true })

async function openSheet() {
  await userEvent.click(screen.getByRole('button', { name: 'Abrir ficha' }))
  return screen.findByRole('dialog', { name: 'Hamburguesa' })
}

describe('Sheet: hoja modal con <dialog> nativo (RF6, RF14)', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cerrada no hay diálogo; abierta es un diálogo con el título como nombre accesible', async () => {
    renderHarness()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    const dialog = await openSheet()
    expect(dialog.tagName).toBe('DIALOG')
    expect(within(dialog).getByRole('heading', { level: 2, name: 'Hamburguesa' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Agregar' })).toBeInTheDocument()
  })

  it('se abre como modal nativo (showModal), que deja inerte el resto de la página', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    renderHarness()
    await openSheet()
    expect(showModal).toHaveBeenCalledTimes(1)
  })

  it('al abrir el foco entra en la hoja (botón de cerrar), no se queda en la página', async () => {
    renderHarness()
    const dialog = await openSheet()
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cerrar' }))
  })

  describe('cierre', () => {
    it('el botón Cerrar la cierra', async () => {
      const onClosed = vi.fn()
      renderHarness(onClosed)
      const dialog = await openSheet()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
      expect(onClosed).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('Escape la cierra', async () => {
      const onClosed = vi.fn()
      renderHarness(onClosed)
      await openSheet()

      await userEvent.keyboard('{Escape}')
      expect(onClosed).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('el evento cancel nativo (Escape en el navegador) se desvía a nuestro cierre animado', async () => {
      const onClosed = vi.fn()
      renderHarness(onClosed)
      const dialog = await openSheet()

      const cancel = new Event('cancel', { cancelable: true })
      dialog.dispatchEvent(cancel)
      expect(cancel.defaultPrevented).toBe(true) // el navegador no la cierra de golpe
      expect(onClosed).toHaveBeenCalledTimes(1)
    })

    it('tocar el fondo la cierra, pero tocar dentro de la hoja no', async () => {
      const onClosed = vi.fn()
      renderHarness(onClosed)
      const dialog = await openSheet()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Primera opción' }))
      await userEvent.click(within(dialog).getByRole('heading', { name: 'Hamburguesa' }))
      expect(onClosed).not.toHaveBeenCalled()

      const backdrop = dialog.querySelector('[data-sheet-backdrop]') as HTMLElement
      expect(backdrop).toBeInTheDocument()
      await userEvent.click(backdrop)
      expect(onClosed).toHaveBeenCalledTimes(1)
    })

    it('el foco vuelve al disparador al cerrar', async () => {
      renderHarness()
      const trigger = screen.getByRole('button', { name: 'Abrir ficha' })
      const dialog = await openSheet()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
    })

    it('el foco vuelve al disparador también al cerrar con Escape', async () => {
      renderHarness()
      const trigger = screen.getByRole('button', { name: 'Abrir ficha' })
      await openSheet()

      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(trigger).toHaveFocus()
    })

    it('se puede abrir otra vez después de cerrar', async () => {
      renderHarness()
      const first = await openSheet()
      await userEvent.click(within(first).getByRole('button', { name: 'Cerrar' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      expect(await openSheet()).toBeInTheDocument()
    })
  })

  describe('movimiento (plan §10)', () => {
    const renderWithMotion = (reducedMotion: 'always' | 'never') =>
      render(
        <I18nProvider>
          <MotionConfig reducedMotion={reducedMotion}>
            <Sheet open title="Hamburguesa" onClose={() => {}}>
              <SheetBody>contenido</SheetBody>
            </Sheet>
          </MotionConfig>
        </I18nProvider>,
      )

    it('con movimiento reducido la hoja solo se funde: no arranca desplazada', async () => {
      renderWithMotion('always')
      const dialog = await screen.findByRole('dialog')
      const panel = dialog.querySelector('[data-sheet-panel]') as HTMLElement
      expect(panel.style.transform).not.toMatch(/translateY/)
      expect(panel.style.opacity).not.toBe('')
    })

    it('sin reducción entra desde abajo (arranca muy por debajo de su lugar)', async () => {
      renderWithMotion('never')
      const dialog = await screen.findByRole('dialog')
      const panel = dialog.querySelector('[data-sheet-panel]') as HTMLElement
      // Ya empezó a moverse hacia 0: lo que cuenta es que partió muy por debajo, no del todo en 100
      const offset = Number(/translateY\((\d+(?:\.\d+)?)%\)/.exec(panel.style.transform)?.[1])
      expect(offset).toBeGreaterThan(50)
    })
  })

  it('no tiene violaciones de accesibilidad (abierta, con título, cuerpo y pie)', async () => {
    renderHarness()
    const dialog = await openSheet()
    await expectNoA11yViolations(dialog)
  })
})

describe('shouldCloseOnDrag: arrastrar la manija (apple-design §5)', () => {
  it('cierra si se arrastró más de 120 px', () => {
    expect(shouldCloseOnDrag(121, 0)).toBe(true)
    expect(shouldCloseOnDrag(120, 0)).toBe(false)
  })

  it('cierra con un lanzamiento rápido hacia abajo aunque el recorrido sea corto', () => {
    expect(shouldCloseOnDrag(30, 501)).toBe(true)
    expect(shouldCloseOnDrag(30, 500)).toBe(false)
  })

  it('arrastrar hacia arriba o soltar sin movimiento no cierra', () => {
    expect(shouldCloseOnDrag(-200, -900)).toBe(false)
    expect(shouldCloseOnDrag(0, 0)).toBe(false)
  })

  it('arrastrar lento lejos hacia arriba y volver hacia abajo con poco recorrido no cierra', () => {
    expect(shouldCloseOnDrag(80, 200)).toBe(false)
  })
})
