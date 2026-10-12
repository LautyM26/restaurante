import css from '../../src/styles/index.css?raw'
import { EASE, SPRING } from '../../src/ui/motion'

// Los tokens de movimiento viven en dos lugares (JS para Motion, CSS para las transiciones): deben coincidir.
describe('ui/motion: tokens (plan §10.1)', () => {
  it('define las cuatro curvas del plan', () => {
    expect(EASE.expo).toEqual([0.16, 1, 0.3, 1])
    expect(EASE.soft).toEqual([0.22, 0.61, 0.36, 1])
    expect(EASE.outStrong).toEqual([0.23, 1, 0.32, 1])
    expect(EASE.drawer).toEqual([0.32, 0.72, 0, 1])
  })

  it.each([
    ['expo', '--ease-expo'],
    ['soft', '--ease-soft'],
    ['outStrong', '--ease-out-strong'],
    ['drawer', '--ease-drawer'],
  ] as const)('la curva %s es la misma que %s de @theme', (key, cssVar) => {
    expect(css).toContain(`${cssVar}: cubic-bezier(${EASE[key].join(', ')});`)
  })

  it('define los dos resortes sin rebote exagerado', () => {
    expect(SPRING.tab).toEqual({ type: 'spring', bounce: 0, duration: 0.35 })
    expect(SPRING.sheetRelease).toEqual({ type: 'spring', bounce: 0.15, duration: 0.4 })
  })
})
