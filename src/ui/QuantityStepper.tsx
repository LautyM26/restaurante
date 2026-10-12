// Selector de cantidad de 1 a 20 (RF20, CL10; plan §9.4). Dos botones de 44 × 44 px y el número entre ellos.
// La cantidad nunca llega a 0: en 1, restar queda apagado, salvo que se pase `onRemove` (resumen del
// pedido): entonces el mismo botón pasa a ser "Quitar", una acción explícita.
import { Minus, Plus, Trash } from '@phosphor-icons/react'
import { MAX_QTY } from '../config'
import { useI18n } from '../i18n/I18nContext'

interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  /** Si se pasa, con cantidad 1 el botón de restar se vuelve "Quitar" y llama a esta función. */
  onRemove?: () => void
  /** Mínimo seleccionable; en la ficha y en el resumen es 1. */
  min?: number
  max?: number
}

const BUTTON =
  'inline-flex size-11 items-center justify-center rounded-full border border-hairline bg-coal-700 text-bone-50 transition-[background-color,transform,opacity] duration-120 ease-out-strong hover:bg-white/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-coal-700 disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100'

export function QuantityStepper({ value, onChange, onRemove, min = 1, max = MAX_QTY }: QuantityStepperProps) {
  const { t } = useI18n()
  const removing = onRemove !== undefined && value <= min

  return (
    <div role="group" aria-label={t('qty.label')} className="inline-flex items-center gap-1">
      {/* Un solo botón para restar y quitar: así el foco del teclado no se pierde al pasar a 1 */}
      <button
        type="button"
        aria-label={removing ? t('cart.remove') : t('qty.decrease')}
        disabled={!removing && value <= min}
        onClick={removing ? onRemove : () => onChange(value - 1)}
        className={BUTTON}
      >
        {removing ? <Trash size={20} weight="bold" aria-hidden="true" /> : <Minus size={20} weight="bold" aria-hidden="true" />}
      </button>

      {/* <output> es una región viva cortés: el lector de pantalla anuncia la cantidad nueva */}
      <output className="min-w-10 text-center font-display text-2xl leading-none font-semibold text-bone-50 tabular-nums">
        {value}
      </output>

      <button
        type="button"
        aria-label={t('qty.increase')}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={BUTTON}
      >
        <Plus size={20} weight="bold" aria-hidden="true" />
      </button>
    </div>
  )
}
