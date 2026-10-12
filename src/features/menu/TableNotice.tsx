// Aviso de la mesa (RF2, RF3, RF41; plan §5.1). Dice qué le pasa a la mesa en lugar de dejar al cliente
// con botones apagados sin explicación:
//   missing / invalid → hay que escanear el QR o pedir ayuda (se puede mirar la carta, no pedir)
//   checking          → se está verificando
//   unverified        → no hubo conexión: "Reintentar" (y se reintenta solo al volver la red)
//   valid             → no hay nada que avisar
import { QrCode, WifiSlash } from '@phosphor-icons/react'
import { useI18n } from '../../i18n/I18nContext'
import { useTable } from '../../state/TableContext'

const BOX = 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-row border border-hairline bg-coal-800 p-3'
const MESSAGE = 'flex min-w-48 flex-1 items-center gap-3 text-[0.9375rem] leading-snug text-ash-300'

export function TableNotice() {
  const { t } = useI18n()
  const table = useTable()

  switch (table.status) {
    case 'valid':
      return null

    case 'checking':
      return (
        <div role="status" className={BOX}>
          <p className={MESSAGE}>
            {/* Punto que late mientras se verifica; quieto con movimiento reducido */}
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-ember-500 motion-safe:animate-pulse" />
            {t('table.checking')}
          </p>
        </div>
      )

    case 'unverified':
      return (
        <div role="status" className={BOX}>
          <p className={MESSAGE}>
            <WifiSlash size={22} aria-hidden="true" className="shrink-0 text-ember-400" />
            {t('table.unverified')}
          </p>
          <button
            type="button"
            onClick={table.retry}
            className="inline-flex min-h-11 items-center rounded-full border border-ember-400/50 px-4 text-[0.9375rem] font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            {t('common.retry')}
          </button>
        </div>
      )

    default:
      // missing e invalid dicen lo mismo: el cliente solo necesita saber cómo conseguir una mesa válida.
      return (
        <div role="note" className={BOX}>
          <p className={MESSAGE}>
            <QrCode size={22} aria-hidden="true" className="shrink-0 text-ember-400" />
            {t('table.notice')}
          </p>
        </div>
      )
  }
}
