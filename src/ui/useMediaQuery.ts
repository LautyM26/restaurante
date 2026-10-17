// Consulta de medios reactiva (plan §10.4). Se lee al montar y se actualiza si el cliente cambia el ajuste
// con la app abierta (movimiento reducido, tamaño de la ventana). Sin `matchMedia` asume que no coincide.
import { useEffect, useState } from 'react'

const matches = (query: string) => typeof window.matchMedia === 'function' && window.matchMedia(query).matches

export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const list = window.matchMedia(query)
    const update = () => setValue(list.matches)
    update()
    list.addEventListener?.('change', update)
    return () => list.removeEventListener?.('change', update)
  }, [query])

  return value
}

/** ¿El sistema pide reducir el movimiento? (reactivo; para código imperativo está `prefersReducedMotion`). */
export const useReducedMotionPreference = () => useMediaQuery('(prefers-reduced-motion: reduce)')
