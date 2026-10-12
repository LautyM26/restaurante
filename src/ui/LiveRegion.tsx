// Región viva única de toda la app (plan §3): quien necesite anunciar algo a un lector de pantalla
// llama a `useAnnounce()`; así los avisos no se duplican en regiones sueltas. El Toast de T9 NO es una
// región viva propia: usa esta.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/** Pausa entre vaciar la región y escribir el mensaje: sin ella, repetir un texto igual no se vuelve a leer. */
const ANNOUNCE_DELAY_MS = 50

type Announce = (message: string) => void

const AnnounceContext = createContext<Announce | null>(null)

export function LiveRegionProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const announce = useCallback<Announce>((next) => {
    clearTimeout(timer.current)
    setMessage('')
    timer.current = setTimeout(() => setMessage(next), ANNOUNCE_DELAY_MS)
  }, [])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnounceContext.Provider>
  )
}

export function useAnnounce(): Announce {
  const announce = useContext(AnnounceContext)
  if (!announce) throw new Error('useAnnounce debe usarse dentro de <LiveRegionProvider>')
  return announce
}
