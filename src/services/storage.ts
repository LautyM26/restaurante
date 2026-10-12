// Almacenamiento seguro (RNF8, CL23): si el navegador lo bloquea o falla (modo privado, cuota),
// la app sigue funcionando guardando en memoria; solo deja de recordar entre recargas.

export interface SafeStorage {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/**
 * Envuelve un Storage. `resolve` se llama en cada operación porque hasta acceder a
 * `window.localStorage` puede lanzar. Cada escritura se refleja en memoria; ante el primer
 * error se usa la memoria para siempre (ponytail: no se reintenta el almacenamiento real).
 */
export function createSafeStorage(resolve: () => Storage): SafeStorage {
  const memory = new Map<string, string>()
  let broken = false

  // Ejecuta sobre el almacenamiento real; si lanza, marca el fallo y devuelve el respaldo.
  const attempt = <T>(action: (storage: Storage) => T, fallback: () => T): T => {
    if (broken) return fallback()
    try {
      return action(resolve())
    } catch {
      broken = true
      return fallback()
    }
  }

  return {
    get: (key) => attempt((s) => s.getItem(key), () => memory.get(key) ?? null),
    set: (key, value) => {
      memory.set(key, value)
      attempt((s) => s.setItem(key, value), () => undefined)
    },
    remove: (key) => {
      memory.delete(key)
      attempt((s) => s.removeItem(key), () => undefined)
    },
  }
}

/** localStorage seguro: compartido entre pestañas del navegador (mismo dispositivo). */
export const createLocalStorage = (): SafeStorage => createSafeStorage(() => window.localStorage)

/** sessionStorage seguro: vive mientras la pestaña siga abierta (pedido en curso, sobrevive a recargas). */
export const createSessionStorage = (): SafeStorage => createSafeStorage(() => window.sessionStorage)
