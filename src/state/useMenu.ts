// Carga y refresco de la carta (RF7-RF9, RF45; plan §5.2). Sin librería de caché: un pedido al montar
// y un refresco silencioso cuando la app vuelve a primer plano.
//   loading → ready (carta ya ordenada y depurada con sortMenu) | error (con "sin conexión" aparte)
//   refresh() es silencioso: sigue mostrando la carta actual y, si falla, no muestra nada
//   (se reintenta en el próximo disparador). El pedido en curso no se toca: sus líneas se
//   revalidan solas porque se derivan de la carta vigente (RF44).
import { useCallback, useEffect, useRef, useState } from 'react'
import { sortMenu } from '../domain/menuOrder'
import type { Menu } from '../domain/types'
import { ServiceError } from '../services/contracts'
import { useServices } from '../services/ServicesContext'

export type MenuState =
  | { status: 'loading' }
  /** `offline`: no hay conexión (según el navegador o un error de red), para un mensaje propio. */
  | { status: 'error'; offline: boolean }
  | { status: 'ready'; menu: Menu }

export type UseMenu = MenuState & {
  /** Vuelve a pedir la carta mostrando la carga (acción "Reintentar"). */
  retry: () => void
  /** Pide la carta sin mostrar la carga; si falla no hace nada visible. */
  refresh: () => void
}

const LOADING: MenuState = { status: 'loading' }

function isOffline(error: unknown): boolean {
  return !navigator.onLine || (error instanceof ServiceError && error.code === 'NETWORK')
}

/** Dos cartas iguales conservan el mismo objeto: así un refresco sin cambios no vuelve a dibujar nada. */
function sameMenu(a: Menu, b: Menu): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useMenu(): UseMenu {
  const { menuService } = useServices()
  const [state, setState] = useState<MenuState>(LOADING)

  // Cada pedido toma un número; si llega la respuesta de uno viejo (o del componente ya desmontado) se ignora.
  const requestId = useRef(0)
  const refreshing = useRef(false)
  // Estado vigente para los oyentes de abajo. Se actualiza junto con setState (no en un efecto): así un
  // evento que llegue justo después de cargar ya ve el estado correcto.
  const status = useRef<MenuState['status']>('loading')

  const load = useCallback(() => {
    const id = ++requestId.current
    status.current = 'loading'
    setState(LOADING)
    menuService.getMenu().then(
      (menu) => {
        if (id !== requestId.current) return
        status.current = 'ready'
        setState({ status: 'ready', menu: sortMenu(menu) })
      },
      (error: unknown) => {
        if (id !== requestId.current) return
        status.current = 'error'
        setState({ status: 'error', offline: isOffline(error) })
      },
    )
  }, [menuService])

  const refresh = useCallback(() => {
    if (status.current !== 'ready' || refreshing.current) return
    refreshing.current = true
    const id = ++requestId.current
    menuService.getMenu().then(
      (menu) => {
        refreshing.current = false
        if (id !== requestId.current) return
        const next = sortMenu(menu)
        setState((current) => (current.status === 'ready' && sameMenu(current.menu, next) ? current : { status: 'ready', menu: next }))
      },
      () => {
        refreshing.current = false // se reintenta en el próximo disparador, sin avisar al cliente
      },
    )
  }, [menuService])

  useEffect(() => {
    load()
    return () => {
      requestId.current++
      refreshing.current = false
    }
  }, [load])

  // Al volver a primer plano: refresco silencioso, o reintento si la carta no había cargado.
  // Al volver la conexión con la carta caída: reintento (igual que la verificación de la mesa).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (status.current === 'ready') refresh()
      else if (status.current === 'error') load()
    }
    const onOnline = () => {
      if (status.current === 'error') load()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [load, refresh])

  return { ...state, retry: load, refresh }
}
