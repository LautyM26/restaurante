import html from '../../index.html?raw'
import css from '../../src/styles/index.css?raw'

/** Contenido del <meta name="..."> o undefined si no existe. */
function metaContent(html: string, name: string): string | undefined {
  const tag = html.match(new RegExp(`<meta[^>]*name="${name}"[^>]*>`))?.[0]
  return tag?.match(/content="([^"]*)"/)?.[1]
}

describe('index.html: base nativa móvil (plan §11)', () => {
  it('declara el viewport con zonas seguras y teclado que redimensiona el contenido', () => {
    const viewport = metaContent(html, 'viewport')
    expect(viewport).toContain('width=device-width')
    expect(viewport).toContain('initial-scale=1')
    expect(viewport).toContain('viewport-fit=cover')
    expect(viewport).toContain('interactive-widget=resizes-content')
  })

  it('nunca desactiva el zoom', () => {
    expect(metaContent(html, 'viewport')).not.toMatch(/user-scalable|maximum-scale/)
  })

  it('coincide la barra de estado con el escenario oscuro', () => {
    expect(metaContent(html, 'theme-color')).toBe('#0c0a09')
    expect(metaContent(html, 'color-scheme')).toBe('dark')
  })

  it('arranca en español', () => {
    expect(html).toMatch(/<html[^>]*lang="es"/)
  })
})

describe('styles/index.css: tokens (plan §9.2-§9.4, §10.1)', () => {
  it('importa Tailwind y define el tema con @theme', () => {
    expect(css).toContain('@import "tailwindcss"')
    expect(css).toContain('@theme')
  })

  it.each([
    ['coal-950', '#0c0a09'],
    ['coal-900', '#15120f'],
    ['coal-800', '#1f1a16'],
    ['coal-700', '#2b241e'],
    ['bone-50', '#f6f1eb'],
    ['ash-300', '#b3a89d'],
    ['ash-500', '#9a8f84'],
    ['ember-300', '#ffc58a'],
    ['ember-400', '#ff9a3d'],
    ['ember-500', '#f2711c'],
    ['ember-700', '#8f3510'],
    ['herb-400', '#8fcf8a'],
    ['chili-400', '#ff6b5e'],
  ])('el color %s vale %s', (name, hex) => {
    expect(css).toMatch(new RegExp(String.raw`--color-${name}:\s*${hex};`, 'i'))
  })

  it('no conserva el ash-500 anterior que no llegaba a 4,5:1', () => {
    expect(css).not.toMatch(/#8a7f75/i)
  })

  it.each([
    ['--ease-expo', 'cubic-bezier(0.16, 1, 0.3, 1)'],
    ['--ease-soft', 'cubic-bezier(0.22, 0.61, 0.36, 1)'],
    ['--ease-out-strong', 'cubic-bezier(0.23, 1, 0.32, 1)'],
    ['--ease-drawer', 'cubic-bezier(0.32, 0.72, 0, 1)'],
  ])('la curva %s vale %s', (name, value) => {
    expect(css).toContain(`${name}: ${value};`)
  })

  it('define las familias tipográficas, los radios y las capas', () => {
    expect(css).toMatch(/--font-display:[^;]*Barlow Condensed/)
    expect(css).toMatch(/--font-sans:[^;]*Barlow/)
    expect(css).toContain('--radius-control: 14px;')
    expect(css).toContain('--radius-row: 16px;')
    expect(css).toContain('--radius-sheet: 28px;')
    expect(css).toContain('--z-cart-bar: 40;')
  })

  it('aplica la base móvil: sin destello al tocar, inputs de 16 px y toque inmediato', () => {
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/)
    expect(css).toMatch(/overscroll-behavior-y:\s*none/)
    expect(css).toMatch(/input,\s*textarea,\s*select\s*{[^}]*font-size:\s*16px/)
    expect(css).toMatch(/touch-action:\s*manipulation/)
  })

  it('no desactiva la selección de texto en el body', () => {
    expect(css).not.toMatch(/body\s*{[^}]*user-select:\s*none/)
  })
})
