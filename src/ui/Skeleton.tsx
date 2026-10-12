// Marcador de carga (RF8): un bloque que parpadea con la forma del contenido final. Es decorativo; quien
// lo usa avisa el estado ("Cargando la carta") con texto para el lector de pantalla. El parpadeo es solo
// de opacidad y se omite con movimiento reducido.
import type { HTMLAttributes } from 'react'

export function Skeleton({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" className={`bg-coal-700/70 motion-safe:animate-pulse ${className}`.trim()} {...rest} />
}
