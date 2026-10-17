// Aviso de que el total cambió entre lo que el cliente vio y lo que el restaurante calculó (RF46, CL14, CL38).
// El pedido NO se registró: el cliente decide. "Aceptar y enviar" manda el total nuevo; "Revisar pedido" lo deja
// editable, con los precios vigentes. Es una alerta y recibe el foco al aparecer.
import { useI18n } from '../../i18n/I18nContext'
import { GlowButton } from '../../ui/GlowButton'
import { focusOnMount } from './focusOnMount'

export interface PriceChangeLine {
  name: string
  oldUnitCents: number
  newUnitCents: number
}

interface PriceChangeNoticeProps {
  oldTotalCents: number
  newTotalCents: number
  /** Solo las líneas cuyo precio cambió. */
  lines: PriceChangeLine[]
  onAccept: () => void
  onReview: () => void
}

export function PriceChangeNotice({ oldTotalCents, newTotalCents, lines, onAccept, onReview }: PriceChangeNoticeProps) {
  const { t, formatPrice } = useI18n()

  return (
    <div
      role="alert"
      tabIndex={-1}
      ref={focusOnMount}
      className="flex flex-col gap-3 rounded-row border border-ember-400/40 bg-coal-900 p-3.5 outline-none"
    >
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[1.375rem] leading-none font-extrabold tracking-[0.005em] text-bone-50 uppercase">
          {t('cart.price.title')}
        </h3>
        <p className="text-base leading-snug text-ash-300">
          {t('cart.price.body', { old: formatPrice(oldTotalCents), new: formatPrice(newTotalCents) })}
        </p>
      </div>

      {lines.length > 0 && (
        <ul className="flex flex-col gap-1.5 border-t border-hairline pt-3">
          {lines.map((line, index) => (
            <li key={`${index}-${line.name}`} className="text-[0.9375rem] leading-snug break-words text-bone-50">
              {t('cart.price.line', { name: line.name, old: formatPrice(line.oldUnitCents), new: formatPrice(line.newUnitCents) })}
            </li>
          ))}
        </ul>
      )}

      <GlowButton wide onClick={onAccept} className="justify-between">
        <span>{t('cart.price.accept')}</span>
        <span className="tabular-nums">{formatPrice(newTotalCents)}</span>
      </GlowButton>
      <button
        type="button"
        onClick={onReview}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-full border border-ember-400/50 px-4 text-base font-semibold text-ember-400 transition-[background-color,transform] duration-120 ease-out-strong hover:bg-ember-500/10 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        {t('cart.price.review')}
      </button>
    </div>
  )
}
