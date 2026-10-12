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

describe('styles/index.css: botón brasa (plan §9.5)', () => {
  const base = blockOf(css, '.btn-ember {')

  it('.btn-ember recorta el banco de luz con su propio radio (overflow hidden)', () => {
    expect(base).toMatch(/overflow:\s*hidden/)
    expect(base).toMatch(/border-radius:\s*9999px/)
  })

  it('el banco de luz es un degradado "to top" que parte del tono claro de 1 px y termina en el cuerpo #140f0c', () => {
    expect(base).toMatch(/linear-gradient\(\s*to top,\s*#ffe2bf 1px,\s*#ffc88f 2px/)
    expect(base).toMatch(/#140f0c 100%\s*\)/)
  })

  it('no dibuja un halo exterior de más de 8 px de desenfoque', () => {
    const shadows = [...base.matchAll(/box-shadow:([^;]+);/g)].map((m) => m[1])
    const blurs = shadows.flatMap((s) =>
      // Cada sombra: x y blur [spread] color; se queda con el tercer valor numérico.
      s.split(/,(?![^(]*\))/).map((layer) => Number(layer.trim().match(/^(?:inset\s+)?-?[\d.]+(?:px)?\s+-?[\d.]+(?:px)?\s+([\d.]+)px/)?.[1] ?? 0)),
    )
    expect(blurs.length).toBeGreaterThan(0)
    expect(Math.max(...blurs)).toBeLessThanOrEqual(8)
  })

  it('::after es la luz de borde lateral, enmascarada y sin capturar toques', () => {
    const after = blockOf(css, '.btn-ember::after {')
    expect(after).toMatch(/pointer-events:\s*none/)
    expect(after).toMatch(/mask-image:/)
    expect(after).toMatch(/255 214 170 \/ 0\.7/)
  })

  it('presionado se achica a 0,97 en 120 ms', () => {
    const active = blockOf(css, '.btn-ember:active:not(:disabled, [aria-busy="true"]) {')
    expect(active).toMatch(/scale\(0\.97\)/)
    expect(base).toMatch(/120ms/)
  })

  it('el hover (solo puntero fino) sube el brillo 1,08 y levanta 1 px', () => {
    const hover = blockOf(css, '@media (hover: hover) and (pointer: fine) {')
    const rule = blockOf(hover, '.btn-ember:hover:not(:disabled, [aria-busy="true"]) {')
    expect(rule).toMatch(/brightness\(1\.08\)/)
    expect(rule).toMatch(/translateY\(-1px\)/)
  })

  it('deshabilitado es brasa apagada: banco coal-700 y texto ash-500', () => {
    const off = blockOf(css, '.btn-ember:disabled {')
    expect(off).toMatch(/var\(--color-coal-700\)/)
    expect(off).toMatch(/color:\s*var\(--color-ash-500\)/)
  })

  it('cargando "respira" con una animación, que se apaga con movimiento reducido', () => {
    const busy = blockOf(css, '.btn-ember[aria-busy="true"]::before {')
    expect(busy).toMatch(/animation:\s*ember-breathe/)
    const reduced = blockOf(css, '@media (prefers-reduced-motion: reduce) {')
    expect(blockOf(reduced, '.btn-ember[aria-busy="true"]::before {')).toMatch(/animation:\s*none/)
  })

  it('la variante streak dibuja una raya de 2 px arriba y lg mide 60 px', () => {
    expect(blockOf(css, '.btn-ember--streak {')).toMatch(/2px/)
    expect(blockOf(css, '.btn-ember--lg {')).toMatch(/min-height:\s*60px/)
    expect(base).toMatch(/min-height:\s*52px/)
  })
})
