// Nota para la cocina (RF14, RF20): texto libre con tope en caracteres VISIBLES (un emoji compuesto cuenta
// como uno), 140 para el plato y 200 para la nota general del pedido. El contador es la descripción
// accesible del campo. Campo de 16 px para que iOS no haga zoom al enfocarlo (skill mobile-native).
import { useId } from 'react'
import { countVisibleChars, limitVisibleChars } from '../../domain/text'
import { useI18n } from '../../i18n/I18nContext'
import type { TranslationKey } from '../../i18n/I18nContext'

interface NoteFieldProps {
  value: string
  onChange: (value: string) => void
  /** Tope en caracteres visibles. */
  max: number
  label: TranslationKey
  placeholder?: TranslationKey
}

export function NoteField({ value, onChange, max, label, placeholder = 'dish.note.placeholder' }: NoteFieldProps) {
  const { t } = useI18n()
  const ids = { field: useId(), counter: useId() }
  // Lo que se muestra nunca pasa el tope, aunque `value` venga más largo de afuera.
  const shown = limitVisibleChars(value, max)
  const count = countVisibleChars(shown)

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={ids.field} className="text-[0.9375rem] font-semibold text-bone-50">
        {t(label)}
      </label>
      <textarea
        id={ids.field}
        value={shown}
        rows={2}
        placeholder={t(placeholder)}
        aria-describedby={ids.counter}
        onChange={(event) => onChange(limitVisibleChars(event.target.value, max))}
        // `field-sizing-content` hace crecer el campo con el texto donde el navegador lo soporta
        className="max-h-40 min-h-20 w-full resize-none rounded-control border border-hairline bg-coal-900 px-3.5 py-3 leading-snug text-bone-50 [field-sizing:content] placeholder:text-ash-500 focus-visible:border-ember-400"
      />
      <p id={ids.counter} className={`text-right text-[0.8125rem] tabular-nums ${count >= max ? 'text-ember-400' : 'text-ash-300'}`}>
        {t('dish.note.counter', { count, max })}
      </p>
    </div>
  )
}
