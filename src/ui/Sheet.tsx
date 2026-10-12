// Hoja modal (RF6, RF14, RF43; plan §9.5 y §10.2). Un <dialog> nativo abierto con showModal(): el navegador
// deja inerte el resto de la página, atrapa el foco y entrega Escape. Encima va Motion:
//   - entra desde abajo con --ease-drawer (380 ms) y sale más rápido (240 ms, out-strong)
//   - con movimiento reducido solo se funde (200 ms)
//   - la manija se arrastra 1:1 con el dedo; se cierra con más de 120 px o más de 500 px/s (apple-design §5)
//
// `open` y `onClose` los maneja quien la usa; el "atrás" del sistema lo conecta `useBackToClose` allí.
// El contenido se arma con SheetBody (se desplaza) y SheetFooter (fijo abajo, con zona segura).
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { AnimatePresence, motion, useDragControls, useReducedMotionConfig } from 'motion/react'
import { useI18n } from '../i18n/I18nContext'
import { EASE } from './motion'

/** Recorrido (px) y velocidad (px/s) hacia abajo a partir de los cuales soltar la manija cierra la hoja. */
const CLOSE_DISTANCE = 120
const CLOSE_VELOCITY = 500

/** ¿Soltar la manija con este recorrido y esta velocidad vertical (positivos = hacia abajo) cierra la hoja? */
export function shouldCloseOnDrag(offsetY: number, velocityY: number): boolean {
  return offsetY > CLOSE_DISTANCE || velocityY > CLOSE_VELOCITY
}

interface SheetProps {
  open: boolean
  onClose: () => void
  /** Título visible y nombre accesible del diálogo. */
  title: string
  children: ReactNode
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  // AnimatePresence mantiene el diálogo montado mientras corre la animación de salida.
  return (
    <AnimatePresence>
      {open && (
        <SheetDialog key="sheet" onClose={onClose} title={title}>
          {children}
        </SheetDialog>
      )}
    </AnimatePresence>
  )
}

function SheetDialog({ onClose, title, children }: Omit<SheetProps, 'open'>) {
  const { t } = useI18n()
  const titleId = useId()
  const reduceMotion = useReducedMotionConfig()
  const dragControls = useDragControls()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Quien tenía el foco al abrir (el disparador): a él se vuelve al cerrar.
  const [opener] = useState(() => document.activeElement)

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  // Al desmontarse el diálogo ya salió del top layer: recién entonces el resto de la página admite foco.
  useEffect(
    () => () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true })
    },
    [opener],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape en el navegador: se cierra por la vía animada y con el historial en orden.
        event.preventDefault()
        onClose()
      }}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-transparent p-0 text-bone-50 backdrop:bg-transparent open:flex open:items-end open:justify-center"
    >
      <motion.div
        data-sheet-backdrop=""
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.24, ease: EASE.outStrong } }}
        exit={{ opacity: 0, transition: { duration: 0.2, ease: EASE.outStrong } }}
      />

      <motion.div
        data-sheet-panel=""
        className="relative flex max-h-[88dvh] w-full min-w-0 flex-col rounded-t-sheet border border-b-0 border-hairline bg-coal-800 shadow-[0_-12px_40px_rgb(0_0_0/0.5)] md:max-w-[560px]"
        initial={reduceMotion ? { opacity: 0 } : { y: '100%' }}
        animate={
          reduceMotion
            ? { opacity: 1, transition: { duration: 0.2, ease: EASE.outStrong } }
            : { y: 0, transition: { duration: 0.38, ease: EASE.drawer } }
        }
        exit={
          reduceMotion
            ? { opacity: 0, transition: { duration: 0.16, ease: EASE.outStrong } }
            : { y: '100%', transition: { duration: 0.24, ease: EASE.outStrong } }
        }
        // Solo hacia abajo: el recorrido sigue al dedo (elástico 1) y hacia arriba casi no cede.
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 1 }}
        onDragEnd={(_event, info) => {
          if (shouldCloseOnDrag(info.offset.y, info.velocity.y)) onClose()
        }}
      >
        {/* Cabecera: la manija y el título arrastran la hoja; el contenido se desplaza sin moverla */}
        <div onPointerDown={(event) => dragControls.start(event)} className="shrink-0 cursor-grab touch-none">
          <div aria-hidden="true" className="flex h-7 items-center justify-center">
            <span className="h-1.5 w-10 rounded-full bg-white/25" />
          </div>
          <div className="flex items-start gap-3 pr-2 pl-4">
            <h2
              id={titleId}
              className="min-w-0 flex-1 pt-1.5 pb-3 font-display text-[1.75rem] leading-[0.95] font-extrabold tracking-[-0.005em] break-words text-bone-50 uppercase"
            >
              {title}
            </h2>
            <button
              ref={closeRef}
              type="button"
              aria-label={t('sheet.close')}
              onClick={onClose}
              onPointerDown={(event) => event.stopPropagation()}
              className="-mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ash-300 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-white/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <X size={22} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>

        {children}
      </motion.div>
    </dialog>
  )
}

/** Zona que se desplaza dentro de la hoja; el desplazamiento no se contagia a la página (overscroll-contain). */
export function SheetBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 ${className}`.trim()}>{children}</div>
  )
}

/** Pie fijo con la acción principal; respeta la zona segura inferior del celular. */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 border-t border-hairline px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
      {children}
    </div>
  )
}
