// Almacenamientos falsos para los tests: uno en memoria y otro que siempre lanza error
// (simula navegador con el almacenamiento bloqueado, RNF8).

/** Storage en memoria con la misma interfaz que localStorage/sessionStorage. */
export function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map<string, string>(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key)
    },
    setItem: (key, value) => {
      data.set(key, String(value))
    },
  }
}

/** Storage cuyos métodos lanzan, como con las cookies de terceros bloqueadas. */
export function createThrowingStorage(): Storage {
  const fail = (): never => {
    throw new DOMException('Almacenamiento bloqueado', 'SecurityError')
  }
  return {
    get length(): number {
      return fail()
    },
    clear: fail,
    getItem: fail,
    key: fail,
    removeItem: fail,
    setItem: fail,
  }
}
