// Botón "brasa" (plan §9.5): la acción principal de cada pantalla. El material vive en `.btn-ember`
// (styles/index.css); aquí solo se arman las clases y el comportamiento accesible.
//   disabled → brasa apagada, no dispara
//   loading  → aria-busy y "respira"; NO usa `disabled` para que el foco del teclado no se pierda,
//              pero tampoco dispara (doble toque, RF24)
import type { ButtonHTMLAttributes } from 'react'

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ocupa todo el ancho disponible (CartBar, pie de las hojas). */
  wide?: boolean
  /** Raya de luz de 2 px arriba; solo la CartBar. */
  streak?: boolean
  /** md = 52 px (primario); lg = 60 px (CartBar). */
  size?: 'md' | 'lg'
  /** Acción en curso: el texto lo cambia quien lo usa ("Enviando pedido"). */
  loading?: boolean
}

export function GlowButton({
  wide = false,
  streak = false,
  size = 'md',
  loading = false,
  type = 'button',
  className = '',
  onClick,
  ...rest
}: GlowButtonProps) {
  const classes = [
    'btn-ember',
    streak && 'btn-ember--streak',
    size === 'lg' && 'btn-ember--lg',
    wide && 'w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    />
  )
}
