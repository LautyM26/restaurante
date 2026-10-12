// Barra fija del pedido en curso (RF19, RF21; plan §9.5 y §10.2). Aparece cuando hay al menos un plato y abre
// el resumen. Es una de las dos superficies con vidrio (la otra es la TopBar).
//
// Confirma cada agregado de forma visible (RF19):
//   - con movimiento: un ping único, un anillo que se agranda y se desvanece (WAAPI, 500 ms, solo transform y opacity)
//   - con movimiento reducido (CL22): sin ping; el borde se resalta por opacidad 1,5 s
// y, si el agregado se recortó a 20, avisa "Máximo 20 por plato" unos segundos. El anuncio para lector de pantalla
// lo hace la ficha por la región viva; aquí el aviso es solo visual (aria-hidden) para no leerlo dos veces.
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotionConfig } from 'motion/react'
import { CART_HIGHLIGHT_MS, TOAST_MS } from '../../config'
import { cartTotalCents } from '../../domain/pricing'
import type { Menu } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { useCart } from '../../state/CartContext'
import { GlowButton } from '../../ui/GlowButton'
import { EASE } from '../../ui/motion'

interface CartBarProps {
  /** La carta vigente, para calcular el total; `null` mientras no cargó. */
  menu: Menu | null
  onOpen: () => void
}

export function CartBar({ menu, onOpen }: CartBarProps) {
  const { t, formatPrice } = useI18n()
  const cart = useCart()
  const reduceMotion = useReducedMotionConfig()
  const visible = cart.units > 0

  const pingRef = useRef<HTMLSpanElement>(null)
  const [highlight, setHighlight] = useState(false)
  const [capNotice, setCapNotice] = useState(false)
  const lastSeq = useRef(cart.lastAdd.seq)

  // Un agregado nuevo (el número sube): confirmar. Lo que ya estaba al montar o un cambio de cantidad no cuenta.
  const { seq, capped } = cart.lastAdd
  useEffect(() => {
    if (seq === lastSeq.current) return
    lastSeq.current = seq

    const timers: ReturnType<typeof setTimeout>[] = []
    if (reduceMotion) {
      setHighlight(true)
      timers.push(setTimeout(() => setHighlight(false), CART_HIGHLIGHT_MS))
    } else {
      // Anillo que crece y se desvanece; más ancho que alto porque la barra ocupa casi todo el ancho.
      pingRef.current?.animate?.(
        [
          { transform: 'scale(1)', opacity: 0.6 },
          { transform: 'scale(1.04, 1.32)', opacity: 0 },
        ],
        { duration: 500, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
      )
    }
    setCapNotice(capped)
    if (capped) timers.push(setTimeout(() => setCapNotice(false), TOAST_MS))
    return () => timers.forEach(clearTimeout)
  }, [seq, capped, reduceMotion])

  const total = menu ? formatPrice(cartTotalCents(cart.lines, menu)) : null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cart-bar"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-(--z-cart-bar) flex flex-col items-center gap-2 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(env(safe-area-inset-bottom)+12px)] pl-[max(0.75rem,env(safe-area-inset-left))]"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(110%)' }}
          animate={
            reduceMotion
              ? { opacity: 1, transition: { duration: 0.2, ease: EASE.outStrong } }
              : { opacity: 1, transform: 'translateY(0%)', transition: { duration: 0.3, ease: EASE.outStrong } }
          }
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0.16, ease: EASE.outStrong } }
              : { opacity: 0, transform: 'translateY(110%)', transition: { duration: 0.2, ease: EASE.outStrong } }
          }
        >
          {capNotice && (
            <p
              aria-hidden="true"
              className="rounded-full border border-hairline bg-coal-800 px-4 py-2 text-[0.9375rem] font-semibold text-ember-400 shadow-[0_8px_24px_rgb(0_0_0/0.35)]"
            >
              {t('cart.maxPerDish')}
            </p>
          )}

          <div
            data-highlight={highlight ? 'true' : 'false'}
            className="glass pointer-events-auto relative w-full max-w-[680px] rounded-full p-1 transition-shadow duration-200 ease-out-strong data-[highlight=true]:shadow-[0_0_0_2px_var(--color-ember-400)]"
          >
            <span
              ref={pingRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-ember-400 opacity-0"
            />
            <GlowButton wide streak size="lg" onClick={onOpen} className="justify-between gap-3 px-5">
              <span className="flex min-w-0 items-center gap-2.5">
                <span>{t('cart.view')}</span>
                {/* El número se anima; su lectura accesible va aparte, sin animación */}
                <span aria-hidden="true" className="relative inline-flex min-w-7 justify-center overflow-hidden rounded-full bg-white/10 px-2 py-1 font-display text-lg leading-none tabular-nums">
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={cart.units}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, transform: 'translateY(8px)' }}
                      animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.18, ease: EASE.outStrong } }}
                      exit={reduceMotion ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, transform: 'translateY(-8px)', transition: { duration: 0.12, ease: EASE.outStrong } }}
                    >
                      {cart.units}
                    </motion.span>
                  </AnimatePresence>
                </span>
                <span className="sr-only">, {t('cart.units', { count: cart.units })}</span>
              </span>
              {total && <span className="font-display text-xl font-semibold tabular-nums">{total}</span>}
            </GlowButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
