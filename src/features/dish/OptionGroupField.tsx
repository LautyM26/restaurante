// Un grupo de opciones de la ficha del plato (RF15-RF17, CL6-CL8).
//   único    → radios: elegir otra reemplaza a la anterior
//   múltiple → casillas: al llegar al máximo las no elegidas se deshabilitan y se anuncia el límite
// Cada opción es una fila de 48 px (objetivo táctil, plan §9.4) con un <input> nativo oculto visualmente:
// teclado, foco y lectores de pantalla funcionan solos. El mensaje "Elegí N opciones" lo recibe el botón
// "Agregar" por aria-describedby (`messageId`).
import { Check } from '@phosphor-icons/react'
import { useId } from 'react'
import type { OptionGroup } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'

interface OptionGroupFieldProps {
  group: OptionGroup
  /** Ids de las opciones elegidas en este grupo. */
  selected: readonly string[]
  /** Tocar una opción; en un grupo opcional de elección única, tocar la elegida pide quitarla. */
  onToggle: (optionId: string) => void
  /** Id del mensaje "Elegí N opciones", para que quien deshabilita "Agregar" lo señale. */
  messageId: string
}

export function OptionGroupField({ group, selected, onToggle, messageId }: OptionGroupFieldProps) {
  const { t, localize, formatPrice } = useI18n()
  const radioName = useId()
  const missing = Math.max(0, group.min - selected.length)
  const atMax = group.type === 'multiple' && selected.length >= group.max

  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-1 flex w-full flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[1.0625rem] font-semibold text-bone-50">{localize(group.name)}</span>
        <span className="flex items-baseline gap-x-1.5 text-[0.8125rem] text-ash-300">
          <span>{group.min > 0 ? t('dish.group.required') : t('dish.group.optional')}</span>
          {group.type === 'multiple' && group.max > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <span>{t('dish.group.upTo', { max: group.max })}</span>
            </>
          )}
        </span>
      </legend>

      {/* Faltan opciones: queda junto al grupo y lo lee "Agregar" como su descripción (RF16) */}
      {missing > 0 && (
        <p id={messageId} className="mb-1 text-[0.9375rem] leading-snug font-medium text-ember-400">
          {t('dish.required', { count: missing })}
        </p>
      )}
      {/* Región viva siempre presente: el aviso del máximo se anuncia cuando aparece (RF17) */}
      <p role="status" className="empty:hidden mb-1 text-[0.9375rem] leading-snug text-ash-300">
        {atMax ? t('dish.maxReached', { max: group.max }) : null}
      </p>

      <ul className="flex flex-col">
        {group.options.map((option) => {
          const isSelected = selected.includes(option.id)
          // Una no disponible no se puede elegir; sí quitar si ya estaba elegida. Con el máximo alcanzado, las demás tampoco.
          const disabled = !isSelected && (!option.available || atMax)
          const single = group.type === 'single'

          return (
            <li key={option.id} className="border-b border-hairline last:border-b-0">
              <label
                className={`flex min-h-12 items-center gap-3 rounded-control py-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember-400 ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer active:bg-white/5'
                }`}
              >
                <input
                  type={single ? 'radio' : 'checkbox'}
                  name={single ? radioName : undefined}
                  value={option.id}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => onToggle(option.id)}
                  // Una radio ya marcada no emite "change": para deseleccionar en un grupo opcional se usa el clic
                  onClick={single && isSelected && group.min === 0 ? () => onToggle(option.id) : undefined}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`grid size-6 shrink-0 place-items-center border-2 transition-colors duration-120 ease-out-strong peer-checked:border-ember-400 peer-checked:bg-ember-500 peer-disabled:border-ash-500/50 motion-reduce:transition-none ${
                    single ? 'rounded-full' : 'rounded-md'
                  } border-ash-500`}
                >
                  {isSelected && (single ? <span className="size-2 rounded-full bg-coal-950" /> : <Check size={14} weight="bold" className="text-coal-950" />)}
                </span>
                <span className={`min-w-0 flex-1 text-base leading-snug break-words ${disabled ? 'text-ash-500' : 'text-bone-50'}`}>
                  {localize(option.name)}
                  {!option.available && (
                    <span className="ml-2 rounded-full border border-hairline px-2 py-0.5 text-[0.75rem] text-ash-300">
                      {t('dish.option.unavailable')}
                    </span>
                  )}
                </span>
                {option.priceDeltaCents > 0 && (
                  <span className={`shrink-0 text-[0.9375rem] tabular-nums ${disabled ? 'text-ash-500' : 'text-ash-300'}`}>
                    +{formatPrice(option.priceDeltaCents)}
                  </span>
                )}
              </label>
            </li>
          )
        })}
      </ul>
    </fieldset>
  )
}
