// Representación visual del plato (plan §9.5): la foto si hay `imageUrl`; si no (o si falla), un degradado
// de la categoría con un ícono de Phosphor. Es conceptual a propósito: no se inventan fotos de comida.
// Es decorativa (alt vacío): el nombre del plato ya está en el texto de la fila.
// Tamaño fijo de 96 × 96 px: la fila no se mueve cuando la imagen termina de cargar.
import { useState } from 'react'
import { BeerStein, BowlSteam, Cheese, CookingPot, Cow, IceCream } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { CategoryVisual } from '../domain/types'

// Los degradados van completos para que Tailwind los detecte. Todos terminan en coal-800 (#1f1a16).
const VISUALS: Record<CategoryVisual, { icon: Icon; surface: string; tint: string }> = {
  starter: { icon: Cheese, surface: 'bg-[linear-gradient(145deg,#4a3d1a,#1f1a16)]', tint: 'text-[#f2d27a]' },
  grill: { icon: Cow, surface: 'bg-[linear-gradient(145deg,#5a2216,#1f1a16)]', tint: 'text-ember-300' },
  main: { icon: CookingPot, surface: 'bg-[linear-gradient(145deg,#4a2c17,#1f1a16)]', tint: 'text-ember-300' },
  pasta: { icon: BowlSteam, surface: 'bg-[linear-gradient(145deg,#4f3a14,#1f1a16)]', tint: 'text-[#ffd9a0]' },
  dessert: { icon: IceCream, surface: 'bg-[linear-gradient(145deg,#4a2432,#1f1a16)]', tint: 'text-[#f6bccd]' },
  drink: { icon: BeerStein, surface: 'bg-[linear-gradient(145deg,#1f3a47,#1f1a16)]', tint: 'text-[#a8d8ee]' },
}

interface DishVisualProps {
  visual: CategoryVisual
  imageUrl?: string
  /** Plato agotado: se apaga en gris (además del texto "Agotado" de la fila). */
  unavailable?: boolean
}

export function DishVisual({ visual, imageUrl, unavailable = false }: DishVisualProps) {
  const { icon: Glyph, surface, tint } = VISUALS[visual]
  // Se recuerda cuál URL falló (no un booleano): si cambia la imagen se vuelve a intentar.
  const [failedUrl, setFailedUrl] = useState<string | undefined>()
  const showImage = imageUrl !== undefined && imageUrl !== failedUrl

  return (
    <span
      aria-hidden="true"
      className={`flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-row border border-hairline ${surface} ${
        unavailable ? 'opacity-60 grayscale' : ''
      }`.trim()}
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
          className="size-full object-cover"
        />
      ) : (
        <Glyph size={40} weight="duotone" className={tint} />
      )}
    </span>
  )
}
