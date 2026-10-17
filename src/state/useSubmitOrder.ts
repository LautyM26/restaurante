// Máquina de envío del pedido (RF24-RF27, RF44, RF46; plan §4 y §5.4). Un solo lugar decide qué pasa
// entre "Enviar pedido" y la respuesta del restaurante, para no duplicar nunca un pedido:
//
//   idle ──submit──▶ sending ──ok──────────────▶ idle (pedido registrado, carrito vacío, onSent)
//                       │       PRICE_CHANGED ──▶ priceChanged   (nada registrado; el cliente decide)
//                       │       LINES_REJECTED ─▶ rejected       (líneas marcadas con su motivo)
//                       │       INVALID_TABLE ──▶ error          (la mesa pasa a inválida; el pedido se conserva, CL1)
//                       │       VALIDATION ─────▶ error
//                       └─ NETWORK / SERVER / 15 s sin respuesta / IDEMPOTENCY_CONFLICT
//                                              ──▶ unresolved    (no se sabe si llegó: edición BLOQUEADA)
//
// El intento (clientRequestId + huella) se guarda en el pedido en curso ANTES de llamar al restaurante, así
// sobrevive a una recarga. Mientras exista un intento sin resolver el pedido no se puede modificar
// (`locked`); "Reintentar" reenvía con el MISMO id y "Editar pedido" primero pregunta si ese id ya estaba
// registrado (CL28). Al montar con un intento persistido se resuelve solo, y de nuevo al volver la conexión.
import { useEffect, useRef, useState } from 'react'
import { SUBMIT_TIMEOUT_MS } from '../config'
import { submissionFingerprint } from '../domain/cart'
import { validateLine } from '../domain/lineValidation'
import { cartTotalCents, unitPriceCents } from '../domain/pricing'
import type { CreateOrderInput, Menu, Order } from '../domain/types'
import { useI18n } from '../i18n/I18nContext'
import { createId } from '../lib/id'
import { ServiceError } from '../services/contracts'
import type { ServiceErrorCode, ServiceErrorDetails } from '../services/contracts'
import { useServices } from '../services/ServicesContext'
import { useAnnounce } from '../ui/LiveRegion'
import { useCart } from './CartContext'
import { myOrdersStore } from './myOrdersStore'
import type { MyOrdersStore } from './myOrdersStore'
import { useTable } from './TableContext'

export type RejectedLine = NonNullable<ServiceErrorDetails['lines']>[number]
export interface PriceChange {
  lineId: string
  oldUnitCents: number
  newUnitCents: number
}

export type SubmitState =
  | { status: 'idle' }
  | { status: 'sending' }
  /** No se sabe si el restaurante recibió el pedido. `resolveFailed`: la consulta por el intento también falló. */
  | { status: 'unresolved'; resolveFailed: boolean; code: ServiceErrorCode }
  | { status: 'priceChanged'; oldTotalCents: number; newTotalCents: number; changedLines: PriceChange[] }
  | { status: 'rejected'; lines: RejectedLine[] }
  | { status: 'error'; code: 'INVALID_TABLE' | 'VALIDATION' }

export interface UseSubmitOrderOptions {
  /** La carta vigente; `null` mientras no cargó (no se puede enviar sin ella). */
  menu: Menu | null
  /** Se llama una vez por pedido registrado (también si se recupera tras un corte). */
  onSent: (order: Order) => void
  /** Pide la carta de nuevo, en silencio, después de un rechazo (plan §5.2). */
  refreshMenu: () => void
  /** El registro de pedidos del dispositivo; por defecto el de la aplicación. */
  store?: MyOrdersStore
}

export interface SubmitOrder {
  state: SubmitState
  /** Hay un intento en curso o sin resolver: el pedido no se puede modificar (RF26). */
  locked: boolean
  /** Envía el pedido, o reintenta el intento pendiente. `expectedTotalCents`: el total que el cliente aceptó (RF46). */
  submit: (options?: { expectedTotalCents?: number }) => Promise<void>
  /** "Editar pedido": comprueba si el intento llegó; si no, libera la edición. */
  edit: () => Promise<void>
  /** "Revisar pedido": descarta el aviso y deja el pedido editable. */
  dismiss: () => void
}

const IDLE: SubmitState = { status: 'idle' }

/** Una respuesta que no llega en `ms` es un resultado desconocido, igual que un corte de red. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ServiceError('NETWORK', 'El restaurante no respondió a tiempo')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const codeOf = (error: unknown): ServiceErrorCode => (error instanceof ServiceError ? error.code : 'SERVER')

export function useSubmitOrder({ menu, onSent, refreshMenu, store = myOrdersStore }: UseSubmitOrderOptions): SubmitOrder {
  const { t } = useI18n()
  const { orderService } = useServices()
  const table = useTable()
  const cart = useCart()
  const announce = useAnnounce()

  // Un estado de aviso (precio, error) solo vale para el contenido con el que se produjo.
  const contentKey = JSON.stringify([cart.lines.map((line) => [line.key, line.quantity]), cart.note])
  const [shown, setShown] = useState<{ value: SubmitState; key: string }>({ value: IDLE, key: '' })
  // `useState` se actualiza tarde: esta marca evita que dos toques seguidos envíen dos veces (RF24).
  const inFlight = useRef(false)
  // Intento que este hook ya está atendiendo: el efecto de recuperación solo mira los que vienen de afuera.
  const handledId = useRef<string | undefined>(undefined)

  const show = (value: SubmitState) => setShown({ value, key: contentKey })

  /** El pedido quedó registrado en el restaurante (envío directo o recuperado). */
  const finish = (order: Order) => {
    store.add({ orderId: order.id, tableId: order.tableId, createdAt: order.createdAt })
    cart.clear()
    setShown({ value: IDLE, key: '' })
    announce(`${t('orders.sent')}: ${order.code}`)
    onSent(order)
  }

  /** El restaurante rechazó el pedido: no quedó registrado, así que el intento se descarta. */
  const reject = (error: unknown, sentTotalCents: number): void => {
    const details = error instanceof ServiceError ? error.details : undefined
    switch (codeOf(error)) {
      case 'PRICE_CHANGED': {
        cart.clearPending()
        refreshMenu()
        const changedLines = (details?.priceLines ?? []).flatMap(({ lineId, unitPriceCents: newUnitCents }) => {
          const line = cart.lines.find((l) => l.key === lineId)
          const dish = line && menu?.dishes.find((d) => d.id === line.dishId)
          const oldUnitCents = line && dish ? unitPriceCents(dish, line.selection) : newUnitCents
          return oldUnitCents === newUnitCents ? [] : [{ lineId, oldUnitCents, newUnitCents }]
        })
        show({ status: 'priceChanged', oldTotalCents: sentTotalCents, newTotalCents: details?.totalCents ?? sentTotalCents, changedLines })
        return
      }
      case 'LINES_REJECTED':
        cart.clearPending()
        refreshMenu()
        show({ status: 'rejected', lines: details?.lines ?? [] })
        return
      case 'INVALID_TABLE':
        cart.clearPending()
        table.markInvalid()
        show({ status: 'error', code: 'INVALID_TABLE' })
        return
      case 'VALIDATION':
        cart.clearPending()
        refreshMenu()
        show({ status: 'error', code: 'VALIDATION' })
        return
      default:
        // Red, servidor, demora o conflicto de idempotencia: puede que el pedido sí haya llegado.
        show({ status: 'unresolved', resolveFailed: false, code: codeOf(error) })
    }
  }

  /** Pregunta al restaurante si el intento pendiente ya estaba registrado. */
  const lookUp = async (clientRequestId: string): Promise<Order | null> =>
    withTimeout(orderService.findByClientRequestId(clientRequestId), SUBMIT_TIMEOUT_MS)

  const resolve = async (): Promise<void> => {
    const pending = cart.pending
    if (!pending || inFlight.current) return
    inFlight.current = true
    handledId.current = pending.clientRequestId
    show({ status: 'sending' })
    try {
      const order = await lookUp(pending.clientRequestId)
      if (order) finish(order)
      else {
        cart.clearPending()
        setShown({ value: IDLE, key: '' })
      }
    } catch (error) {
      show({ status: 'unresolved', resolveFailed: true, code: codeOf(error) })
    } finally {
      inFlight.current = false
    }
  }

  const submit = async ({ expectedTotalCents }: { expectedTotalCents?: number } = {}): Promise<void> => {
    if (inFlight.current) return
    if (table.status !== 'valid' || !menu || cart.lines.length === 0) return
    // Un reintento reenvía lo que ya se intentó: solo un envío nuevo exige que todas las líneas sean válidas.
    const retrying = cart.pending !== undefined
    if (!retrying && cart.lines.some((line) => validateLine(menu, line).length > 0)) return

    inFlight.current = true
    try {
      const totalCents = expectedTotalCents ?? cartTotalCents(cart.lines, menu)
      const content: Omit<CreateOrderInput, 'clientRequestId'> = {
        tableId: table.tableId,
        items: cart.lines.map(({ key, dishId, quantity, selection, note }) => ({
          lineId: key,
          dishId,
          quantity,
          selection,
          ...(note && { note }),
        })),
        ...(cart.note && { note: cart.note }),
        expectedTotalCents: totalCents,
      }
      const fingerprint = submissionFingerprint(content)
      let clientRequestId = cart.pending?.clientRequestId

      // El contenido cambió (por ejemplo, un precio) mientras el intento estaba sin resolver: reenviar con otro id
      // podría duplicar un pedido que sí llegó. Primero se pregunta por el anterior.
      if (cart.pending && cart.pending.fingerprint !== fingerprint) {
        show({ status: 'sending' })
        try {
          const registered = await lookUp(cart.pending.clientRequestId)
          if (registered) return finish(registered)
        } catch (error) {
          return show({ status: 'unresolved', resolveFailed: true, code: codeOf(error) })
        }
        clientRequestId = undefined
      }

      // Mismo contenido que el intento pendiente → mismo id; si no, id nuevo. Se guarda ANTES de enviar.
      if (!clientRequestId) {
        clientRequestId = createId()
        cart.setPending({ clientRequestId, fingerprint, startedAt: new Date().toISOString() })
      }
      handledId.current = clientRequestId
      show({ status: 'sending' })
      try {
        finish(await withTimeout(orderService.createOrder({ clientRequestId, ...content }), SUBMIT_TIMEOUT_MS))
      } catch (error) {
        reject(error, totalCents)
      }
    } finally {
      inFlight.current = false
    }
  }

  // Lo último, para los efectos de abajo (que no se vuelven a crear en cada render).
  const latest = useRef({ resolve, status: shown.value.status })
  useEffect(() => {
    latest.current = { resolve, status: shown.value.status }
  })

  // Un intento persistido sin resolver (recarga, pestaña restaurada): se consulta solo, una vez por intento.
  const pendingId = cart.pending?.clientRequestId
  useEffect(() => {
    if (pendingId && pendingId !== handledId.current) void latest.current.resolve()
  }, [pendingId])

  // Si la consulta falló por falta de red, se repite al volver la conexión.
  useEffect(() => {
    if (!pendingId) return
    const retryLookUp = () => {
      if (latest.current.status === 'unresolved') void latest.current.resolve()
    }
    window.addEventListener('online', retryLookUp)
    return () => window.removeEventListener('online', retryLookUp)
  }, [pendingId])

  // Estado que se muestra: los avisos de precio y de error caducan si el pedido cambia; el rechazo de líneas
  // solo mira las que siguen en el pedido.
  let state = shown.value
  if ((state.status === 'priceChanged' || state.status === 'error') && shown.key !== contentKey) state = IDLE
  if (state.status === 'rejected') {
    const lines = state.lines.filter((rejected) => cart.lines.some((line) => line.key === rejected.lineId))
    state = lines.length > 0 ? { status: 'rejected', lines } : IDLE
  }

  return {
    state,
    locked: cart.pending !== undefined,
    submit,
    edit: resolve,
    dismiss: () => setShown({ value: IDLE, key: '' }),
  }
}
