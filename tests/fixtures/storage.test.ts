import { createMemoryStorage, createThrowingStorage } from './storage'

describe('fixtures/storage', () => {
  it('el storage en memoria guarda, lee, borra y arranca con datos iniciales', () => {
    const storage = createMemoryStorage({ a: '1' })
    expect(storage.getItem('a')).toBe('1')
    storage.setItem('b', '2')
    expect(storage.getItem('b')).toBe('2')
    expect(storage.length).toBe(2)
    storage.removeItem('a')
    expect(storage.getItem('a')).toBeNull()
    storage.clear()
    expect(storage.length).toBe(0)
  })

  it('el storage que lanza falla en cada operación', () => {
    const storage = createThrowingStorage()
    expect(() => storage.getItem('a')).toThrow()
    expect(() => storage.setItem('a', '1')).toThrow()
    expect(() => storage.removeItem('a')).toThrow()
  })
})
