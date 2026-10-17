// Distintivo "Mesa 12" (plan §9.5): 36 px de alto, radio de 12 px y un azulejo de ícono de 28 px
// pegado al borde. Recibe el número ya validado; no sabe de dónde salió (eso lo decide TableContext).
import { ForkKnife } from '@phosphor-icons/react'
import { useI18n } from '../i18n/I18nContext'
import { IconTile } from './IconTile'

export function TableBadge({ tableId }: { tableId: number }) {
  const { t } = useI18n()
  return (
    <div className="inline-flex h-9 items-center gap-2.5 rounded-badge border border-hairline bg-coal-800 pr-3.5 pl-[3px] text-[0.9375rem] font-semibold text-bone-50">
      <IconTile icon={ForkKnife} size="sm" />
      <span className="tabular-nums">{t('table.badge', { n: tableId })}</span>
    </div>
  )
}
