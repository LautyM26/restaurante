// Entrada animada de la portada, una vez por sesión (RF5, RF6, RNF8).
// Devuelve `true` mientras la secuencia debe reproducirse: la primera vez que la pestaña abre la app, nunca con
// movimiento reducido, y solo durante lo que dura la secuencia (así, si la carta se vuelve a montar al volver de
// "Mis pedidos", la portada aparece directamente). Se recuerda en sessionStorage; si el navegador lo bloquea,
// la entrada se reproduce y el hook no rompe (createSafeStorage).
import { useEffect, useState } from 'react'
import { createSessionStorage } from '../../services/storage'
import { INTRO_MS, prefersReducedMotion } from '../../ui/motion'

export const INTRO_STORAGE_KEY = 'fogon.intro'
/** Margen tras el último paso de la entrada antes de dar la secuencia por terminada. */
const SETTLE_MS = 200

export function useIntroOnce(): boolean {
  // Solo se LEE al inicializar: un doble montaje de desarrollo (StrictMode) ejecuta esta función dos veces
  // y la segunda no debe encontrar la marca que dejó la primera. La marca se escribe en el efecto.
  const [playing, setPlaying] = useState(() => !prefersReducedMotion() && createSessionStorage().get(INTRO_STORAGE_KEY) === null)

  useEffect(() => {
    if (!playing) return
    createSessionStorage().set(INTRO_STORAGE_KEY, '1')
    const timer = window.setTimeout(() => setPlaying(false), INTRO_MS + SETTLE_MS)
    return () => window.clearTimeout(timer)
    // `playing` solo cambia a false, que es justo cuando no hay nada que programar
  }, [playing])

  return playing
}
