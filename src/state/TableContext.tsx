// Mesa de la sesión (RF1-RF3, RF41; plan §4 y §5.1). Se deriva de la URL del QR, nunca se guarda:
// cada escaneo decide la mesa. El estado cuenta qué sabemos de ella:
//   missing / invalid → la URL no trae una mesa usable (solo lectura, RF2)
//   checking          → se está preguntando al restaurante (agregar y enviar apagados, RF3)
//   valid             → la mesa existe
//   unverified        → no se pudo preguntar (red o servidor): "Reintentar" y reintento solo al volver la conexión (RF41)
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { TableParam } from '../domain/table'
import { useServices } from '../services/ServicesContext'

export type TableState =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'checking' | 'valid' | 'unverified'; tableId: number }

export type Table = TableState & {
  /** Vuelve a verificar la mesa; solo hace algo si está `unverified`. */
  retry: () => void
  /** El restaurante rechazó el pedido con INVALID_TABLE (CL1): la mesa pasa a `invalid`. */
  markInvalid: () => void
}

const TableContext = createContext<Table | null>(null)

/** `parsed` se lee una sola vez de la URL; si cambiara, habría que remontar el provider (con `key`). */
export function TableProvider({ parsed, children }: { parsed: TableParam; children: ReactNode }) {
  const { menuService } = useServices()
  const requestedId = parsed.kind === 'valid' ? parsed.tableId : null

  const [state, setState] = useState<TableState>(() =>
    requestedId === null
      ? { status: parsed.kind === 'missing' ? 'missing' : 'invalid' }
      : { status: 'checking', tableId: requestedId },
  )
  // Cada reintento cambia este número y vuelve a disparar la consulta.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (requestedId === null) return
    let ignore = false
    menuService.getTable(requestedId).then(
      (found) => {
        if (!ignore) setState(found ? { status: 'valid', tableId: requestedId } : { status: 'invalid' })
      },
      () => {
        if (!ignore) setState({ status: 'unverified', tableId: requestedId })
      },
    )
    return () => {
      ignore = true
    }
  }, [menuService, requestedId, attempt])

  const retry = useCallback(() => {
    if (state.status !== 'unverified') return
    setState({ status: 'checking', tableId: state.tableId })
    setAttempt((n) => n + 1)
  }, [state])

  const markInvalid = useCallback(() => setState({ status: 'invalid' }), [])

  // Al volver la conexión se reintenta solo (RF41); el oyente existe solo mientras haya algo que reintentar.
  useEffect(() => {
    if (state.status !== 'unverified') return
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [state.status, retry])

  const value = useMemo<Table>(() => ({ ...state, retry, markInvalid }), [state, retry, markInvalid])
  return <TableContext.Provider value={value}>{children}</TableContext.Provider>
}

export function useTable(): Table {
  const table = useContext(TableContext)
  if (!table) throw new Error('useTable debe usarse dentro de <TableProvider>')
  return table
}
