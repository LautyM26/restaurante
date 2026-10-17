// Chispas del escenario (plan §9.5): un div de 1 px con un `box-shadow` con una sombra por chispa. Se genera
// una sola vez con un PRNG con semilla, así que es estático (cero trabajo por cuadro) y siempre igual.
// Va detrás de todo (--z-stage), es decorativo y no atrapa toques.

/** Generador pseudoaleatorio mulberry32: mismo número semilla, misma secuencia. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Valor de `box-shadow` con `count` chispas repartidas en un área de `width × height` px. Se juntan más hacia
 * abajo (de donde sube la luz de brasa) y varían en tamaño y brillo.
 */
export function emberShadows(seed: number, count: number, width: number, height: number): string {
  const random = mulberry32(seed)
  const sparks: string[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(random() * width)
    const y = Math.round(Math.sqrt(random()) * height)
    const spread = random() < 0.25 ? 1 : 0
    const alpha = (0.25 + random() * 0.55).toFixed(2)
    sparks.push(`${x}px ${y}px 0 ${spread}px rgb(255 160 90 / ${alpha})`)
  }
  return sparks.join(', ')
}

// Cubre el ancho máximo de la portada (1120 px) y su altura máxima; en celular el borde la recorta.
const SHADOWS = emberShadows(12, 64, 1120, 760)

export function EmberField() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-(--z-stage) overflow-hidden">
      <div style={{ width: 1, height: 1, boxShadow: SHADOWS }} />
    </div>
  )
}
