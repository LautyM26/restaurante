// "Atrás" cierra la hoja (RF43, CL29; plan §5.8). Al abrir una hoja se empuja una entrada de historial
// con la misma URL; el "atrás" del sistema o del navegador la saca y entonces se cierra la hoja en lugar
// de salir de la pantalla. Si la hoja se cierra desde la interfaz, se retrocede esa entrada para que el
// historial quede como estaba.
import { useEffect, useRef } from 'react'

export function useBackToClose(open: boolean, close: () => void) {
  // Siempre el último `close` y el último `open`, sin volver a suscribir el oyente en cada render.
  const closeRef = useRef(close)
  const openRef = useRef(open)
  const mounted = useRef(false)
  // ¿La entrada de la hoja sigue en el historial? Es lo que se debe deshacer al cerrar desde la interfaz.
  const pushed = useRef(false)

  useEffect(() => {
    closeRef.current = close
    openRef.current = open
  })
  // StrictMode monta, desmonta y vuelve a montar: `mounted` distingue un desmontaje real de ese simulacro.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!open) return
    if (!pushed.current) {
      window.history.pushState({ ...window.history.state, sheet: true }, '')
      pushed.current = true
    }

    const onPopState = () => {
      // El sistema ya sacó la entrada: solo hay que cerrar la hoja.
      pushed.current = false
      closeRef.current()
    }
    window.addEventListener('popstate', onPopState)

    return () => {
      window.removeEventListener('popstate', onPopState)
      // Se decide en un microtask: si el efecto se vuelve a ejecutar enseguida (doble montaje de StrictMode),
      // la hoja sigue abierta y la entrada se conserva.
      queueMicrotask(() => {
        if (!pushed.current || (openRef.current && mounted.current)) return
        pushed.current = false
        window.history.back()
      })
    }
  }, [open])
}
