import { describe, expect, it, vi } from 'vitest'
import { createSafeStorage } from '../../src/services/storage'
import { createMemoryStorage, createThrowingStorage } from '../fixtures/storage'

describe('createSafeStorage con un almacenamiento que funciona', () => {
  it('lee, escribe y borra sobre el almacenamiento real', () => {
    const backing = createMemoryStorage()
    const storage = createSafeStorage(() => backing)

    expect(storage.get('k')).toBeNull()
    storage.set('k', 'v')
    expect(backing.getItem('k')).toBe('v')
    expect(storage.get('k')).toBe('v')
    storage.remove('k')
    expect(backing.getItem('k')).toBeNull()
    expect(storage.get('k')).toBeNull()
  })

  it('ve lo que otro escribió en el mismo almacenamiento (otra pestaña)', () => {
    const backing = createMemoryStorage({ shared: 'de otra pestaña' })
    const storage = createSafeStorage(() => backing)
    expect(storage.get('shared')).toBe('de otra pestaña')
    backing.setItem('shared', 'cambió')
    expect(storage.get('shared')).toBe('cambió')
  })
})

describe('createSafeStorage con un almacenamiento que lanza error (RNF8)', () => {
  it('funciona en memoria sin lanzar', () => {
    const storage = createSafeStorage(() => createThrowingStorage())

    expect(storage.get('k')).toBeNull()
    expect(() => storage.set('k', 'v')).not.toThrow()
    expect(storage.get('k')).toBe('v')
    storage.set('k', 'w')
    expect(storage.get('k')).toBe('w')
    expect(() => storage.remove('k')).not.toThrow()
    expect(storage.get('k')).toBeNull()
  })

  it('funciona cuando el acceso mismo a window.localStorage lanza', () => {
    const storage = createSafeStorage(() => {
      throw new DOMException('Bloqueado', 'SecurityError')
    })
    storage.set('a', '1')
    expect(storage.get('a')).toBe('1')
  })

  it('se pasa a memoria si el almacenamiento falla a mitad de camino y conserva lo escrito', () => {
    const backing = createMemoryStorage()
    const storage = createSafeStorage(() => backing)
    storage.set('antes', '1')

    vi.spyOn(backing, 'setItem').mockImplementation(() => {
      throw new DOMException('Cuota excedida', 'QuotaExceededError')
    })
    expect(() => storage.set('despues', '2')).not.toThrow()

    expect(storage.get('despues')).toBe('2')
    expect(storage.get('antes')).toBe('1')
  })
})

describe('createSessionStorage (pedido en curso por pestaña, RF23)', () => {
  it('escribe en sessionStorage y no en localStorage', async () => {
    const { createSessionStorage } = await import('../../src/services/storage')
    window.sessionStorage.clear()
    window.localStorage.clear()
    const storage = createSessionStorage()

    storage.set('k', 'v')
    expect(window.sessionStorage.getItem('k')).toBe('v')
    expect(window.localStorage.getItem('k')).toBeNull()
    expect(storage.get('k')).toBe('v')
    storage.remove('k')
    expect(window.sessionStorage.getItem('k')).toBeNull()
  })

  it('con sessionStorage bloqueado sigue funcionando en memoria (RNF8)', async () => {
    const { createSessionStorage } = await import('../../src/services/storage')
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new DOMException('Bloqueado', 'SecurityError')
    })
    const storage = createSessionStorage()

    expect(() => storage.set('k', 'v')).not.toThrow()
    expect(storage.get('k')).toBe('v')
    vi.restoreAllMocks()
  })
})
