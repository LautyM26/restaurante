import css from '../../src/styles/index.css?raw'

/** Cuerpo (sin llaves externas) del primer bloque que empieza con `header`, respetando llaves anidadas. */
function blockOf(source: string, header: string): string {
  const start = source.indexOf(header)
  if (start === -1) return ''
  const open = source.indexOf('{', start + header.length - 1)
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i)
  }
  return ''
}

describe('styles/index.css: material de vidrio (plan §9.2, §9.5 y §10.4)', () => {
  it('define el borde hairline como token', () => {
    expect(css).toMatch(/--color-hairline:\s*rgb\(255 240 225 \/ 0\.1\);/)
  })

  it('.glass: fondo translúcido, desenfoque con prefijo para Safari y borde de 1 px', () => {
    const glass = blockOf(css, '.glass {')
    expect(glass).toMatch(/background-color:\s*rgb\(21 18 15 \/ 0\.72\)/)
    expect(glass).toMatch(/-webkit-backdrop-filter:\s*blur\(16px\) saturate\(140%\)/)
    expect(glass).toMatch(/(?<!-webkit-)backdrop-filter:\s*blur\(16px\) saturate\(140%\)/)
    expect(glass).toMatch(/border:\s*1px solid var\(--color-hairline\)/)
  })

  it('con transparencia reducida el vidrio pasa a coal-900 sólido y sin desenfoque', () => {
    const reduced = blockOf(css, '@media (prefers-reduced-transparency: reduce) {')
    const glass = blockOf(reduced, '.glass {')
    expect(glass).toMatch(/background-color:\s*var\(--color-coal-900\)/)
    expect(glass).toMatch(/(?<!-webkit-)backdrop-filter:\s*none/)
    expect(glass).toMatch(/-webkit-backdrop-filter:\s*none/)
  })

  it('sin soporte de backdrop-filter el vidrio es casi opaco para no perder legibilidad', () => {
    const fallback = blockOf(css, '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {')
    expect(blockOf(fallback, '.glass {')).toMatch(/background-color:\s*rgb\(21 18 15 \/ 0\.96\)/)
  })

  it('con contraste alto los hairlines suben a rgb(255 255 255 / 0.3)', () => {
    const more = blockOf(css, '@media (prefers-contrast: more) {')
    expect(more).toMatch(/--color-hairline:\s*rgb\(255 255 255 \/ 0\.3\)/)
  })
})
