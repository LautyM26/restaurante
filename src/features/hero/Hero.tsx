// Portada de la carta (RF4-RF6; plan §3, §9.5, §9.6, §10.3): el número de mesa, el titular en dos líneas, un
// subtítulo, el acceso "Ver la carta" y, debajo, el anillo de platos destacados que el panel de la carta tapa
// en su tercio inferior. La marca vive en la barra superior (TopBar), presente sobre la portada.
//
// "Ver la carta" hace scrollIntoView de `#carta` (el panel) y NO toca el hash: el hash lo gobierna la navegación
// (useHashScreen). Con movimiento reducido el desplazamiento es directo (plan §10.4).
// `intro` es la entrada animada de una sola vez (useIntroOnce); sin ella todo nace en su sitio.
import { motion } from 'motion/react'
import type { Menu } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { useTable } from '../../state/TableContext'
import { GlowButton } from '../../ui/GlowButton'
import { introProps, prefersReducedMotion } from '../../ui/motion'
import { TableBadge } from '../../ui/TableBadge'
import { useMediaQuery } from '../../ui/useMediaQuery'
import { DishRing } from './DishRing'
import { EmberField } from './EmberField'

interface HeroProps {
  /** La carta vigente; de ahí salen los platos del anillo. `null` mientras carga o si falló. */
  menu: Menu | null
  /** Reproducir la secuencia de entrada. */
  intro?: boolean
}

function seeMenu() {
  document.getElementById('carta')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

export function Hero({ menu, intro = false }: HeroProps) {
  const { t } = useI18n()
  const table = useTable()
  const compact = !useMediaQuery('(min-width: 768px)')
  // El texto trae un salto de línea entre las dos líneas del titular (cada una se revela por separado).
  const [first, ...rest] = t('hero.title').split('\n')
  const second = rest.join(' ')

  return (
    // Alto de la portada: una pantalla (máx. 760 px) menos el aire que deja la barra superior (lo pone <main>).
    <div className="relative flex min-h-[calc(min(100svh,760px)-5.5rem-env(safe-area-inset-top))] flex-col">
      <EmberField />

      <div className="relative flex flex-1 flex-col items-start justify-center gap-3 pt-2 md:items-center md:text-center">
        {table.status === 'valid' && (
          <motion.div {...introProps(intro, 'badge', compact)}>
            <TableBadge tableId={table.tableId} />
          </motion.div>
        )}

        {/* Dos renglones; el espacio entre ellos es para el lector de pantalla y los nombres accesibles. */}
        <h1 className="font-display text-[clamp(3.25rem,16vw,6rem)] leading-[0.86] font-extrabold tracking-[-0.01em] text-balance text-bone-50 uppercase [text-shadow:0_0_34px_rgb(255_150_80/0.18)]">
          <motion.span data-hero-line className="block" {...introProps(intro, 'titleLine1', compact)}>
            {first}
          </motion.span>{' '}
          <motion.span data-hero-line className="block" {...introProps(intro, 'titleLine2', compact)}>
            {second}
          </motion.span>
        </h1>

        <motion.p
          className="max-w-[30ch] text-[1.0625rem] leading-snug text-ash-300 md:max-w-[40ch] md:text-lg"
          {...introProps(intro, 'subtitle', compact)}
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div className="pt-1" {...introProps(intro, 'cta', compact)}>
          <GlowButton onClick={seeMenu}>{t('hero.cta')}</GlowButton>
        </motion.div>
      </div>

      {/* Hacia abajo, hasta el panel. Los costados se recortan sin barra de desplazamiento y se funden. */}
      <motion.div
        className="relative -mx-4 mt-auto overflow-x-clip pt-6 [mask-image:linear-gradient(to_right,transparent,#000_8%,#000_92%,transparent)] md:-mx-6"
        {...introProps(intro, 'ring', compact)}
      >
        <DishRing menu={menu} />
      </motion.div>
    </div>
  )
}
