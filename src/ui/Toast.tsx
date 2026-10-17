// Aviso breve de cambio de estado en la carta (RF47; plan §9.5): píldora de vidrio debajo de la TopBar con el
// mensaje, "Ver" (lleva a "Mis pedidos") y cerrar. Uno a la vez: un aviso nuevo reemplaza al anterior y reinicia
// la cuenta. Dura `TOAST_MS` y se pausa mientras tiene el foco o el puntero encima (WCAG 2.2.1).
// NO es una región viva: el anuncio para lector de pantalla sale por la `LiveRegion` global, para no leerlo dos veces.
import { useEffect, useState } from 'react'
import { X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { TOAST_MS } from '../config'
import { GlassPill } from './GlassPill'
import { EASE } from './motion'

export interface ToastData {
  /** Cambia con cada aviso: es lo que reinicia la cuenta y la entrada. */
  id: number
  message: string
  icon: Icon
}

interface ToastProps {
  toast: ToastData | null
  actionLabel: string
  closeLabel: string
  onAction: () => void
  onClose: () => void
}

const BUTTON =
  'inline-flex min-h-11 items-center justify-center rounded-full transition-[background-color,transform] duration-120 ease-out-strong active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100'

export function Toast({ toast, actionLabel, closeLabel, onAction, onClose }: ToastProps) {
  const [paused, setPaused] = useState(false)
  const id = toast?.id

  // Cada aviso arranca la cuenta de cero; pausar la cancela y al reanudar vuelve a empezar.
  useEffect(() => {
    if (id === undefined || paused) return
    const timer = setTimeout(onClose, TOAST_MS)
    return () => clearTimeout(timer)
  }, [id, paused, onClose])

  if (!toast) return null
  const Glyph = toast.icon

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4.75rem)] z-(--z-toast) flex justify-center pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
      <motion.div
        key={toast.id}
        className="pointer-events-auto w-full max-w-[420px]"
        initial={{ opacity: 0, transform: 'translateY(-12px)' }}
        animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.25, ease: EASE.outStrong } }}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false)
        }}
      >
        <GlassPill className="flex items-center gap-2 py-1 pr-1 pl-4">
          <Glyph size={20} weight="fill" aria-hidden="true" className="shrink-0 text-ember-400" />
          <p className="min-w-0 flex-1 py-2 text-[0.9375rem] leading-snug font-semibold text-bone-50 [overflow-wrap:anywhere]">
            {toast.message}
          </p>
          <button type="button" onClick={onAction} className={`${BUTTON} shrink-0 px-3 text-[0.9375rem] font-semibold text-ember-400 hover:bg-ember-500/10`}>
            {actionLabel}
          </button>
          <button type="button" onClick={onClose} aria-label={closeLabel} className={`${BUTTON} size-11 shrink-0 text-ash-300 hover:bg-white/10`}>
            <X size={18} weight="bold" aria-hidden="true" />
          </button>
        </GlassPill>
      </motion.div>
    </div>
  )
}
