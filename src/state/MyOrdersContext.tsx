// Pedidos del dispositivo en tiempo real (RF28-RF31, RF39, RF40, RF42, RF47; plan §5.5). Siempre montado: lo
// usan la TopBar (contador y novedad), el aviso de la carta y "Mis pedidos".
//
// Consistencia (RNF10): se suscribe ANTES de pedir los pedidos y guarda en un buffer lo que llega mientras
// carga; después todo pasa por `upsertOrders`/`mergeOrder` (gana el `updatedAt` más nuevo), así que no hay
// duplicados (POST + `order.created`), retrocesos ni huecos entre la carga y la suscripción. El provider no
// sabe cómo llegan los eventos: BroadcastChannel en la demo, WebSocket con el backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { isFinal } from '../domain/orderStatus'
import { upsertOrders } from '../domain/orderMerge'
import type { Order } from '../domain/types'
import { useI18n } from '../i18n/I18nContext'
import { useServices } from '../services/ServicesContext'
import { useAnnounce } from '../ui/LiveRegion'
import { myOrdersStore } from './myOrdersStore'
import type { MyOrdersStore } from './myOrdersStore'
import { useTable } from './TableContext'

export interface MyOrders {
  /** Todos los pedidos del dispositivo de las últimas 12 horas (de cualquier mesa), del más nuevo al más viejo. */
  orders: Order[]
  /** Hay pedidos registrados y la primera carga no terminó (evita mostrar "sin pedidos" por un instante). */
  loading: boolean
  /** Los que todavía no llegaron a un estado final. */
  activeOrders: Order[]
  /** Hubo un cambio de estado fuera de "Mis pedidos" que el cliente todavía no vio. */
  hasNews: boolean
  clearNews: () => void
  /** Último cambio de estado (`seq` sube con cada uno); lo usa la carta para mostrar el aviso breve (RF47). */
  lastChange: { seq: number; order: Order } | null
  /** "Mis pedidos" avisa si está abierta: con ella abierta los cambios no dejan novedad y al entrar se limpia la que había. */
  setViewingOrders: (viewing: boolean) => void
  /** Un pedido quedó registrado en el restaurante: lo incorpora sin esperar a la red. */
  register: (order: Order) => void
  /** Vuelve a pedir los pedidos al restaurante (nunca retrocede un estado). */
  refresh: () => Promise<void>
}

const MyOrdersContext = createContext<MyOrders | null>(null)

const sameEntries = (a: { orderId: string; tableId: number }[], b: { orderId: string; tableId: number }[]) =>
  a.length === b.length && a.every((entry, i) => entry.orderId === b[i].orderId && entry.tableId === b[i].tableId)

export function MyOrdersProvider({ store = myOrdersStore, children }: { store?: MyOrdersStore; children: ReactNode }) {
  const { orderService } = useServices()
  const { t } = useI18n()
  const announce = useAnnounce()
  const table = useTable()

  const [entries, setEntries] = useState(() => store.read())
  const [orders, setOrders] = useState<Order[]>([])
  const [loaded, setLoaded] = useState(false)
  const [hasNews, setHasNews] = useState(false)
  const [lastChange, setLastChange] = useState<MyOrders['lastChange']>(null)

  // Lo vigente para los callbacks de servicio, que viven más que un render.
  const ordersRef = useRef<Order[]>([])
  const idsRef = useRef<string[]>([])
  const requested = useRef(new Set<string>())
  const viewing = useRef(false)
  const say = useRef({ t, announce })
  useEffect(() => {
    say.current = { t, announce }
  })

  // El registro cambia en esta pestaña (envío) o en otra (evento `storage`).
  useEffect(() => {
    const sync = () => setEntries((previous) => (sameEntries(previous, store.read()) ? previous : store.read()))
    sync()
    return store.subscribe(sync)
  }, [store])

  const orderIds = useMemo(() => entries.map((entry) => entry.orderId), [entries])
  const currentTable = table.status === 'valid' ? table.tableId : null
  const tableIds = useMemo(
    () =>
      [...new Set([...entries.map((entry) => entry.tableId), ...(currentTable === null ? [] : [currentTable])])].sort(
        (a, b) => a - b,
      ),
    [entries, currentTable],
  )
  idsRef.current = orderIds
  const idsKey = orderIds.join(',')
  const tablesKey = tableIds.join(',')

  /** Un cambio de estado real: se anuncia (RF29) y, si el cliente no está en "Mis pedidos", deja novedad (RF47). */
  const notifyChange = useCallback((order: Order) => {
    const { t: say_t, announce: say_announce } = say.current
    say_announce(say_t('orders.announce', { code: order.code, status: say_t(`status.${order.status}`) }))
    setLastChange((previous) => ({ seq: (previous?.seq ?? 0) + 1, order }))
    if (!viewing.current) setHasNews(true)
  }, [])

  const apply = useCallback(
    (incoming: Order[]) => {
      const before = new Map(ordersRef.current.map((order) => [order.id, order]))
      const merged = upsertOrders(ordersRef.current, incoming)
      ordersRef.current = merged
      setOrders(merged)
      for (const order of merged) {
        const previous = before.get(order.id)
        if (previous && previous.status !== order.status) notifyChange(order)
      }
    },
    [notifyChange],
  )

  /** Pide los pedidos; los que el restaurante ya no conoce se quitan del registro (NOT_FOUND). Un fallo no rompe nada. */
  const fetchOrders = useCallback(
    async (ids: string[]): Promise<void> => {
      if (ids.length === 0) return
      try {
        const found = await orderService.getOrders(ids)
        apply(found)
        const gone = ids.filter((id) => !ordersRef.current.some((order) => order.id === id))
        if (gone.length > 0) store.remove(gone)
      } catch {
        // Sin red o con el servidor caído se conserva lo que hay; vuelve a intentarse al refrescar.
      } finally {
        setLoaded(true)
      }
    },
    [orderService, apply, store],
  )

  // 1) Suscribir PRIMERO, con buffer. 2) Cargar. 3) Aplicar el buffer y seguir en vivo.
  useEffect(() => {
    if (tableIds.length === 0) return
    let alive = true
    let loaded = false
    const buffer: Order[] = []
    const unsubscribe = orderService.subscribe(
      (event) => {
        if (!alive) return
        if (!loaded) buffer.push(event.order)
        else if (idsRef.current.includes(event.order.id)) apply([event.order])
      },
      { kind: 'tables', tableIds },
    )
    const ids = idsRef.current
    ids.forEach((id) => requested.current.add(id))
    void fetchOrders(ids).then(() => {
      loaded = true
      if (!alive) return
      for (const order of buffer.splice(0)) if (idsRef.current.includes(order.id)) apply([order])
    })
    return () => {
      alive = false
      unsubscribe()
    }
    // El conjunto de mesas va por su clave: el arreglo es nuevo en cada cambio de pedidos.
  }, [orderService, tablesKey, apply, fetchOrders])

  // Pedidos registrados que todavía no se pidieron (otra pestaña, o una mesa ya suscripta).
  useEffect(() => {
    const fresh = orderIds.filter((id) => !requested.current.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => requested.current.add(id))
    void fetchOrders(fresh)
  }, [idsKey, fetchOrders])

  const refresh = useCallback(() => fetchOrders(idsRef.current), [fetchOrders])

  // Al volver a primer plano o recuperar la conexión se recupera lo que se pudo haber perdido (RF30).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'hidden') void refresh()
    }
    const onOnline = () => void refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [refresh])

  const register = useCallback(
    (order: Order) => {
      requested.current.add(order.id) // ya lo tenemos: no hace falta pedirlo
      apply([order])
      store.add({ orderId: order.id, tableId: order.tableId, createdAt: order.createdAt })
    },
    [apply, store],
  )

  const clearNews = useCallback(() => setHasNews(false), [])
  const setViewingOrders = useCallback((isViewing: boolean) => {
    viewing.current = isViewing
    if (isViewing) setHasNews(false)
  }, [])

  const value = useMemo<MyOrders>(() => {
    // Solo los pedidos que el registro todavía recuerda (12 h).
    const known = new Set(orderIds)
    const mine = orders.filter((order) => known.has(order.id))
    return {
      orders: mine,
      activeOrders: mine.filter((order) => !isFinal(order.status)),
      loading: !loaded && mine.length === 0 && orderIds.length > 0,
      hasNews,
      clearNews,
      lastChange,
      setViewingOrders,
      register,
      refresh,
    }
  }, [orders, orderIds, loaded, hasNews, clearNews, lastChange, setViewingOrders, register, refresh])

  return <MyOrdersContext.Provider value={value}>{children}</MyOrdersContext.Provider>
}

export function useMyOrders(): MyOrders {
  const myOrders = useContext(MyOrdersContext)
  if (!myOrders) throw new Error('useMyOrders debe usarse dentro de <MyOrdersProvider>')
  return myOrders
}
