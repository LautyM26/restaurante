import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmberField, emberShadows } from '../../../src/features/hero/EmberField'
import { expectNoA11yViolations } from '../../utils'

describe('EmberField: las chispas del escenario (plan §9.5)', () => {
  it('es decorativo y no atrapa toques', async () => {
    const { container } = render(<EmberField />)
    const field = container.firstElementChild as HTMLElement
    expect(field).toHaveAttribute('aria-hidden', 'true')
    expect(field.className).toContain('pointer-events-none')
    await expectNoA11yViolations(container)
  })

  it('es determinista: la misma semilla da las mismas chispas', () => {
    expect(emberShadows(7, 30, 720, 700)).toBe(emberShadows(7, 30, 720, 700))
  })

  it('otra semilla da otra distribución', () => {
    expect(emberShadows(7, 30, 720, 700)).not.toBe(emberShadows(8, 30, 720, 700))
  })

  it('genera tantas sombras como chispas, dentro del área', () => {
    const points = [...emberShadows(3, 25, 400, 500).matchAll(/(-?\d+)px (-?\d+)px/g)].map((m) => [Number(m[1]), Number(m[2])])
    expect(points).toHaveLength(25)
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(400)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(500)
    }
  })
})
