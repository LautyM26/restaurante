import { createId } from '../../src/lib/id'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Crypto sin randomUUID (contexto no seguro, http:// por IP local) que rellena con `fill`. */
function insecureCrypto(fill: (index: number) => number): Crypto {
  return {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      const bytes = array as unknown as Uint8Array
      for (let i = 0; i < bytes.length; i++) bytes[i] = fill(i)
      return array
    },
  } as unknown as Crypto
}

describe('createId', () => {
  it('usa randomUUID cuando existe', () => {
    const randomUUID = vi.fn(() => 'uuid-nativo')
    const getRandomValues = vi.fn()
    expect(createId({ randomUUID, getRandomValues } as unknown as Crypto)).toBe('uuid-nativo')
    expect(randomUUID).toHaveBeenCalledTimes(1)
    expect(getRandomValues).not.toHaveBeenCalled()
  })

  it('sin randomUUID genera un UUID v4 válido con getRandomValues', () => {
    expect(createId(insecureCrypto((i) => i * 17))).toMatch(UUID_V4)
  })

  it('fuerza versión 4 y variante RFC 4122 aunque los bytes sean todo ceros o todo unos', () => {
    expect(createId(insecureCrypto(() => 0x00))).toBe('00000000-0000-4000-8000-000000000000')
    expect(createId(insecureCrypto(() => 0xff))).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff')
  })

  it('dos llamadas con bytes distintos dan ids distintos', () => {
    let n = 0
    const crypto = insecureCrypto(() => n++ % 256)
    expect(createId(crypto)).not.toBe(createId(crypto))
  })

  it('por defecto usa el crypto global y devuelve un UUID v4', () => {
    expect(createId()).toMatch(UUID_V4)
  })
})
