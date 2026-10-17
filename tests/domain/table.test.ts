import { parseTableParam } from '../../src/domain/table'

describe('parseTableParam', () => {
  it.each([
    ['?mesa=12', 12],
    ['?mesa=012', 12],
    ['mesa=5', 5],
    ['?mesa=999', 999],
    ['?otro=1&mesa=7', 7],
  ])('%s es una mesa válida (%i)', (search, tableId) => {
    expect(parseTableParam(search)).toEqual({ kind: 'valid', tableId })
  })

  it.each(['', '?', '?otro=1', '?mesa='])('%j se considera ausente', (search) => {
    expect(parseTableParam(search)).toEqual({ kind: 'missing' })
  })

  it.each([
    ['?mesa=abc', 'abc'],
    ['?mesa=0', '0'],
    ['?mesa=000', '000'],
    ['?mesa=-3', '-3'],
    ['?mesa=12.5', '12.5'],
    ['?mesa=1000', '1000'],
    ['?mesa=%2012', ' 12'],
    ['?mesa=12%20', '12 '],
  ])('%s es inválida y conserva el valor crudo', (search, raw) => {
    expect(parseTableParam(search)).toEqual({ kind: 'invalid', raw })
  })

  it('con "mesa" repetida vale la primera', () => {
    expect(parseTableParam('?mesa=5&mesa=abc')).toEqual({ kind: 'valid', tableId: 5 })
    expect(parseTableParam('?mesa=abc&mesa=5')).toEqual({ kind: 'invalid', raw: 'abc' })
  })
})
