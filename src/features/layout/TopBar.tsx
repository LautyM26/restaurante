// Barra superior fija (RF4, RF32, RF42; plan §9.5): una píldora de vidrio con la marca, el acceso a
// "Mis pedidos" y el selector de idioma. Contenido que se desplaza pasa por debajo (apple-design §12).
// T9 le suma el contador de pedidos activos y el punto de novedad.
import { Fire, Receipt } from '@phosphor-icons/react'
import { RESTAURANT } from '../../config'
import { useI18n } from '../../i18n/I18nContext'
import { useTable } from '../../state/TableContext'
import { GlassPill } from '../../ui/GlassPill'
import { IconTile } from '../../ui/IconTile'
import { LanguageToggle } from './LanguageToggle'

interface TopBarProps {
  onOpenOrders: () => void
  /** La pantalla "Mis pedidos" está abierta (se marca con aria-current). */
  ordersOpen?: boolean
}

export function TopBar({ onOpenOrders, ordersOpen = false }: TopBarProps) {
  const { t } = useI18n()
  const table = useTable()

  return (
    // El contenedor ocupa todo el ancho pero no atrapa toques (pointer-events-none): solo la píldora los recibe.
    // Respeta el notch arriba y a los costados; 12 px de margen como mínimo (plan §9.5).
    <header className="pointer-events-none fixed inset-x-0 top-0 z-(--z-top-bar) pt-[calc(env(safe-area-inset-top)+8px)] pr-[max(0.75rem,env(safe-area-inset-right))] pl-[max(0.75rem,env(safe-area-inset-left))]">
      <GlassPill className="pointer-events-auto mx-auto flex h-14 max-w-[680px] items-center gap-2 pr-2 pl-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={Fire} />
          <span className="truncate font-display text-xl font-extrabold tracking-wide text-bone-50 uppercase">
            {RESTAURANT.name}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {/* A la izquierda del selector: al aparecer tras verificar la mesa, el selector no se corre. */}
          {table.status === 'valid' && (
            <button
              type="button"
              onClick={onOpenOrders}
              aria-current={ordersOpen ? 'page' : undefined}
              className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full px-2.5 text-[0.9375rem] font-semibold text-bone-50 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-white/10 active:scale-[0.97] aria-[current=page]:bg-coal-700 motion-reduce:transition-none motion-reduce:active:scale-100 min-[30rem]:px-3.5"
            >
              <Receipt size={22} weight="bold" aria-hidden="true" className="text-ember-400" />
              {/* Con poco ancho solo el ícono; el nombre accesible es el mismo (plan §9.5) */}
              <span className="sr-only min-[30rem]:not-sr-only">{t('orders.title')}</span>
            </button>
          )}
          <LanguageToggle />
        </div>
      </GlassPill>
    </header>
  )
}
