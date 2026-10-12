// Azulejo con ícono (adaptado del badge de ref1, plan §9.1): cuadrado redondeado con degradado de brasa.
// Es decorativo: el texto que lo acompaña ya dice lo que significa. El ícono oscuro sobre la brasa
// clara da más de 3:1 en todo el degradado (plan §9.2: los íconos necesitan 3:1).
import type { Icon } from '@phosphor-icons/react'
import type { HTMLAttributes } from 'react'

const SIZES = {
  sm: { box: 'size-7 rounded-lg', icon: 16 },
  md: { box: 'size-8 rounded-[10px]', icon: 18 },
} as const

interface IconTileProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  icon: Icon
  /** sm = 28 px (TableBadge), md = 32 px (marca de la barra). */
  size?: keyof typeof SIZES
}

export function IconTile({ icon: Glyph, size = 'md', className = '', ...rest }: IconTileProps) {
  const { box, icon } = SIZES[size]
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border border-ember-700 bg-[linear-gradient(145deg,var(--color-ember-300),var(--color-ember-500))] text-coal-950 shadow-[inset_0_1px_0_rgb(255_226_191/0.6)] ${box} ${className}`.trim()}
      {...rest}
    >
      <Glyph size={icon} weight="fill" />
    </span>
  )
}
