import css from '../../src/styles/index.css?raw'

/** Cuerpo del primer bloque que empieza con `header`, respetando llaves anidadas. */
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

describe('styles/index.css: hojas modales (plan §9.5)', () => {
  it('con una hoja abierta la página de atrás no se desplaza (html:has(dialog[open]))', () => {
    const lock = blockOf(css, 'html:has(dialog[open]) {')
    expect(lock).toMatch(/overflow:\s*hidden/)
  })
})
