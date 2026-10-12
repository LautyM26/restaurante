// Navegación sin router (RF32; plan §5.8 y D2): dos pantallas, la carta (`#/` o sin hash) y "Mis pedidos"
// (`#/orders`). Cada cambio de pantalla es una entrada de historial, así el "atrás" del sistema vuelve a la
// carta. `history.state.from` recuerda de dónde se vino para que "volver" sepa si hay a dónde retroceder.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export type Screen = 'menu' | 'orders'

const HASHES: Record<Screen, string> = { menu: '#/', orders: '#/orders' }
const APP_ID = 'restaurante'

/** Un hash desconocido cae en la carta: nunca se muestra una pantalla vacía. */
function screenFromHash(hash: string): Screen {
  return /^#\/orders\/?$/.test(hash) ? 'orders' : 'menu'
}

interface HashScreenOptions {
  /**
   * Se llama, antes de que React cambie el DOM, con la pantalla que se está dejando. Sirve para guardar el
   * scroll de la carta mientras la página todavía tiene su altura (después el navegador lo recortaría).
   */
  onLeave?: (from: Screen) => void
}

export function useHashScreen({ onLeave }: HashScreenOptions = {}) {
  const [screen, setScreen] = useState<Screen>(() => screenFromHash(window.location.hash))
  // La pantalla vigente también va en una ref: los oyentes de popstate se registran una sola vez.
  const current = useRef(screen)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => {
    onLeaveRef.current = onLeave
  })

  const show = useCallback((next: Screen) => {
    if (next === current.current) return
    onLeaveRef.current?.(current.current)
    current.current = next
    setScreen(next)
  }, [])

  useEffect(() => {
    // "Atrás", "adelante" o un hash editado a mano: la URL manda.
    const sync = () => show(screenFromHash(window.location.hash))
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [show])

  const navigate = useCallback(
    (next: Screen, { replace = false }: { replace?: boolean } = {}) => {
      if (next === current.current) return
      // La URL es relativa ('#/orders'): se conserva la ruta y el ?mesa= del QR.
      window.history[replace ? 'replaceState' : 'pushState']({ app: APP_ID, from: current.current }, '', HASHES[next])
      show(next)
    },
    [show],
  )

  const goBackToMenu = useCallback(() => {
    if (current.current === 'menu') return
    if (window.history.state?.from === 'menu') {
      // La entrada anterior es la carta: retroceder conserva su posición y el popstate actualiza la pantalla.
      window.history.back()
    } else {
      // Se entró directo a #/orders (no hay carta atrás): se reemplaza la entrada para no dejar historial roto.
      window.history.replaceState({ app: APP_ID }, '', HASHES.menu)
      show('menu')
    }
  }, [show])

  return useMemo(() => ({ screen, navigate, goBackToMenu }), [screen, navigate, goBackToMenu])
}
