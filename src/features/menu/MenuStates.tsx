// Estados de la carta que no son la carta (RF8, RF9, RF10): cargando, error y vacía.
// Sin cajas ni tarjetas: contenido centrado sobre el fondo, igual que el resto de la carta.
import { BowlFood, WarningCircle, WifiSlash } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { motion } from 'motion/react'
import { useI18n } from '../../i18n/I18nContext'
import { GlowButton } from '../../ui/GlowButton'
import { EASE } from '../../ui/motion'
import { Skeleton } from '../../ui/Skeleton'

/** Una fila de plato en esqueleto: dos líneas de texto, el precio y el cuadrado de 96 px. */
function RowSkeleton({ wide }: { wide: boolean }) {
  return (
    <div className="flex items-start gap-4 border-b border-hairline py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Skeleton className={`h-4 rounded-full ${wide ? 'w-3/4' : 'w-1/2'}`} />
        <Skeleton className="h-3.5 w-full rounded-full" />
        <Skeleton className={`h-3.5 rounded-full ${wide ? 'w-2/3' : 'w-4/5'}`} />
        <Skeleton className="mt-0.5 h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="size-24 shrink-0 rounded-row" />
    </div>
  )
}

/** Marcadores con la forma del contenido final (RF8): pestañas, dos títulos y tres filas por categoría. */
export function MenuLoading() {
  const { t } = useI18n()
  return (
    <div aria-busy="true">
      {/* Los marcadores son decorativos; el lector de pantalla oye este texto */}
      <p className="sr-only">{t('menu.loading')}</p>
      <Skeleton className="mt-1 h-[54px] w-full rounded-full" />
      {[0, 1].map((group) => (
        <div key={group} className="pt-6">
          <Skeleton className="h-9 w-2/3 rounded-lg" />
          <div className="mt-2">
            {[0, 1, 2].map((row) => (
              <RowSkeleton key={row} wide={(group + row) % 2 === 0} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

interface MessageProps {
  icon: Icon
  title: string
  hint?: string
  onRetry?: () => void
  /** El mensaje interrumpe (error): lo anuncia el lector de pantalla. */
  alert?: boolean
}

function StateMessage({ icon: Glyph, title, hint, onRetry, alert = false }: MessageProps) {
  const { t } = useI18n()
  return (
    <motion.div
      role={alert ? 'alert' : undefined}
      // Entrada corta de opacidad y 4 px de desplazamiento (plan §10.2, errores en línea)
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE.outStrong }}
      className="flex flex-col items-center gap-4 px-2 py-16 text-center"
    >
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full border border-hairline bg-coal-800">
        <Glyph size={28} className="text-ember-400" />
      </span>
      <div className="flex max-w-80 flex-col gap-1.5">
        <p className="text-[1.0625rem] leading-snug font-semibold text-bone-50">{title}</p>
        {hint && <p className="text-[0.9375rem] leading-snug text-ash-300">{hint}</p>}
      </div>
      {onRetry && <GlowButton onClick={onRetry}>{t('common.retry')}</GlowButton>}
    </motion.div>
  )
}

/** La carta no se pudo cargar (RF9): dice qué pasó y deja reintentar. Sin conexión tiene mensaje propio. */
export function MenuError({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const { t } = useI18n()
  return offline ? (
    <StateMessage alert icon={WifiSlash} title={t('menu.offline')} hint={t('menu.offlineHint')} onRetry={onRetry} />
  ) : (
    <StateMessage alert icon={WarningCircle} title={t('menu.error')} onRetry={onRetry} />
  )
}

/** La carta cargó pero no tiene ningún plato (RF10): explica y sugiere consultar al personal. */
export function MenuEmpty() {
  const { t } = useI18n()
  return <StateMessage icon={BowlFood} title={t('menu.empty')} />
}
