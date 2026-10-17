// Píldora de vidrio (plan §9.1, ref2): superficie translúcida con desenfoque y borde de 1 px.
// El material vive en la clase `.glass` de styles/index.css (con sus respaldos para transparencia
// reducida y navegadores sin backdrop-filter); este componente solo la aplica.
import type { ElementType, HTMLAttributes } from 'react'

interface GlassPillProps extends HTMLAttributes<HTMLElement> {
  /** Elemento HTML a dibujar; por defecto un div. */
  as?: ElementType
}

export function GlassPill({ as: Tag = 'div', className = '', ...rest }: GlassPillProps) {
  return <Tag className={`glass rounded-full ${className}`.trim()} {...rest} />
}
