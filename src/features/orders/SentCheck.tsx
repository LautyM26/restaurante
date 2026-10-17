// Tilde de "pedido enviado" (RF25): un círculo y una marca que se dibujan una vez. Momento poco frecuente,
// así que vale un gesto breve (350 ms, ease-out fuerte, solo trazo); con movimiento reducido aparece ya dibujado.
// Es decorativo: "Pedido enviado" y el código ya van en texto.
import { motion, useReducedMotionConfig } from 'motion/react'
import { EASE } from '../../ui/motion'

export function SentCheck() {
  const reduceMotion = useReducedMotionConfig()
  const draw = (delay: number) => ({
    initial: { pathLength: reduceMotion ? 1 : 0 },
    animate: { pathLength: 1, transition: { duration: 0.35, delay: reduceMotion ? 0 : delay, ease: EASE.outStrong } },
  })

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-7 shrink-0 text-herb-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <motion.circle cx="12" cy="12" r="10" {...draw(0)} />
      <motion.path d="M7.5 12.5l3 3L16.5 9" {...draw(0.2)} />
    </svg>
  )
}
