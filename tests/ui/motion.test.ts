import { afterEach, describe, expect, it, vi } from 'vitest'
import css from '../../src/styles/index.css?raw'
import { EASE, INTRO_MS, INTRO_STEPS, SPRING, introProps, prefersReducedMotion } from '../../src/ui/motion'

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

describe('ui/motion: prefersReducedMotion (plan §10.4)', () => {
  afterEach(() => vi.restoreAllMocks())

  const stubMedia = (matches: boolean) =>
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches, media: query }) as unknown as MediaQueryList)

  it('es verdadero cuando el sistema pide reducir el movimiento', () => {
    const spy = stubMedia(true)
    expect(prefersReducedMotion()).toBe(true)
    expect(spy).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')
  })

  it('es falso cuando no lo pide', () => {
    stubMedia(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('lee la preferencia en cada llamada (el cliente puede cambiarla con la app abierta)', () => {
    const spy = stubMedia(false)
    prefersReducedMotion()
    prefersReducedMotion()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sin matchMedia asume movimiento normal', () => {
    const original = window.matchMedia
    // @ts-expect-error simula un navegador sin matchMedia
    window.matchMedia = undefined
    try {
      expect(prefersReducedMotion()).toBe(false)
    } finally {
      window.matchMedia = original
    }
  })
})

describe('ui/motion: timeline de entrada (plan §10.3, RF5)', () => {
  it('ningún paso termina después de 1,8 s y el más largo cierra justo en 1,8 s', () => {
    expect(INTRO_MS).toBe(1800)
    const ends = Object.values(INTRO_STEPS).map((step) => Math.round((step.delay + step.duration) * 1000))
    expect(Math.max(...ends)).toBeLessThanOrEqual(INTRO_MS)
    expect(Math.max(...ends)).toBe(1800) // el panel: 900 ms de demora + 900 ms
  })

  it('respeta la tabla del plan en tiempos y curvas', () => {
    expect(INTRO_STEPS.topBar).toMatchObject({ delay: 0.06, duration: 0.62 })
    expect(INTRO_STEPS.titleLine1).toMatchObject({ delay: 0.38, duration: 0.9 })
    expect(INTRO_STEPS.titleLine2).toMatchObject({ delay: 0.47, duration: 0.9 })
    expect(INTRO_STEPS.subtitle).toMatchObject({ delay: 0.69, duration: 0.62 })
    expect(INTRO_STEPS.cta).toMatchObject({ delay: 0.83, duration: 0.62 })
    expect(INTRO_STEPS.ring).toMatchObject({ delay: 0.7, duration: 0.95 })
    expect(INTRO_STEPS.brand).toMatchObject({ delay: 0.15, duration: 0.52 })
  })

  it('sin reproducir la entrada deja todo en su lugar desde el primer cuadro', () => {
    expect(introProps(false, 'cta')).toEqual({ initial: false })
  })

  it('al reproducirla parte de transparente y desplazado, y llega a su lugar con la curva del plan', () => {
    const props = introProps(true, 'subtitle')
    expect(props.initial).toEqual({ opacity: 0, transform: 'translateY(10px)' })
    expect(props.animate).toEqual({ opacity: 1, transform: 'translateY(0px)' })
    expect(props.transition).toEqual({ duration: 0.62, delay: 0.69, ease: EASE.expo })
  })

  it('usa la curva suave en los elementos secundarios de la barra', () => {
    expect(introProps(true, 'language').transition?.ease).toEqual(EASE.soft)
  })

  it('en celular las distancias se multiplican por 0,66', () => {
    expect(introProps(true, 'topBar', true).initial).toEqual({ opacity: 0, transform: 'translateY(-5.94px)' })
    expect(introProps(true, 'topBar', false).initial).toEqual({ opacity: 0, transform: 'translateY(-9px)' })
  })

  it('las cadenas de transform son completas, también con escala', () => {
    const props = introProps(true, 'badge')
    expect(props.initial).toEqual({ opacity: 0, transform: 'translateY(11px) scale(0.985)' })
    expect(props.animate).toEqual({ opacity: 1, transform: 'translateY(0px) scale(1)' })
  })

  it('los renglones del titular se revelan con clip-path, sin recortar el resplandor de los costados', () => {
    const props = introProps(true, 'titleLine2')
    expect(props.initial).toMatchObject({ clipPath: 'inset(100% -50% -30% -50%)' })
    expect(props.animate).toMatchObject({ clipPath: 'inset(-30% -50% -30% -50%)' })
  })
})
