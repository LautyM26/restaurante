// Scroll-spy de la carta (RF12): qué categoría está a la vista, con IntersectionObserver (nunca un oyente de
// `scroll`, plan §10.2). Una sección cuenta como "a la vista" si toca la franja que va desde debajo de la
// barra fija hasta la mitad de la pantalla; si hay varias gana la de más abajo, la que acaba de entrar.
//
// Al tocar una pestaña la categoría se marca de inmediato y la observación se PAUSA hasta que termina el
// desplazamiento: si no, el resaltado pasaría saltando por todas las categorías del medio. Termina con
// `scrollend` o, en navegadores sin ese evento, a los 1000 ms.
import { useCallback, useEffect, useRef, useState } from 'react'

const LOCK_FALLBACK_MS = 1000

export function useScrollSpy(sectionIds: readonly string[], getOffset: () => number) {
  const [activeId, setActiveId] = useState<string | undefined>(sectionIds[0])
  const intersecting = useRef(new Map<string, boolean>())
  const idsRef = useRef(sectionIds)
  const releaseLock = useRef<(() => void) | null>(null)
  const [offsetVersion, setOffsetVersion] = useState(0)
  const key = sectionIds.join('\n')

  // Siempre hay una categoría activa mientras haya categorías; si la activa desaparece de la carta, la primera.
  const current = activeId !== undefined && sectionIds.includes(activeId) ? activeId : sectionIds[0]

  useEffect(() => {
    idsRef.current = sectionIds
  })

  /** La de más abajo (en el orden de la carta) entre las que están en la franja. */
  const lowestVisible = useCallback(() => {
    return [...idsRef.current].reverse().find((id) => intersecting.current.get(id))
  }, [])

  // El observador se arma al montar y se rehace si cambian las categorías o la altura de la barra.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    intersecting.current.clear()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting.current.set(entry.target.id, entry.isIntersecting)
        if (releaseLock.current) return // desplazamiento en curso: se aplica al terminar
        const id = lowestVisible()
        if (id) setActiveId(id)
      },
      { rootMargin: `-${Math.round(getOffset())}px 0px -50% 0px` },
    )
    for (const id of idsRef.current) {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    }
    return () => observer.disconnect()
    // `key` representa a sectionIds: se rehace solo si cambian de verdad, no en cada render.
  }, [key, getOffset, lowestVisible, offsetVersion])

  // Si cambia la altura de la barra (giro de pantalla, zona segura) la franja se recalcula.
  useEffect(() => {
    let last = getOffset()
    const onResize = () => {
      const next = getOffset()
      if (Math.round(next) === Math.round(last)) return
      last = next
      setOffsetVersion((version) => version + 1)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [getOffset])

  /** Marca la categoría ya y pausa la observación hasta que termine el desplazamiento. */
  const select = useCallback(
    (id: string) => {
      releaseLock.current?.()
      setActiveId(id)

      let timer: ReturnType<typeof setTimeout> | undefined
      const release = () => {
        clearTimeout(timer)
        window.removeEventListener('scrollend', release)
        releaseLock.current = null
        // Si la página llegó al fondo, una categoría corta nunca alcanza la franja: queda la tocada.
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
        if (atBottom) return
        const visible = lowestVisible()
        if (visible) setActiveId(visible)
      }
      releaseLock.current = release
      window.addEventListener('scrollend', release)
      timer = setTimeout(release, LOCK_FALLBACK_MS)
    },
    [lowestVisible],
  )

  // Al desmontar no queda ningún oyente vivo (el temporizador pendiente no hace nada sin componente).
  useEffect(
    () => () => {
      const release = releaseLock.current
      if (release) {
        window.removeEventListener('scrollend', release)
        releaseLock.current = null
      }
    },
    [],
  )

  return { activeId: current, select }
}
