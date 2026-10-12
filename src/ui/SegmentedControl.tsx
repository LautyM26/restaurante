// Control segmentado de píldora (plan §9.4): elige una opción entre pocas. Está hecho con radios
// nativos ocultos dentro de <label>: el navegador da gratis el foco, las flechas y el anuncio
// "botón de opción, 1 de 2, seleccionado" (ponytail: nada de roles ARIA ni teclado a mano).
import { useId } from 'react'
import type { ReactNode } from 'react'

export interface Segment<T extends string> {
  value: T
  /** Texto visible (corto: "ES"). */
  label: ReactNode
  /** Nombre accesible completo ("Español"); si falta se usa el texto visible. */
  ariaLabel?: string
  /** Idioma del texto, para que el lector de pantalla lo pronuncie bien. */
  lang?: string
}

interface SegmentedControlProps<T extends string> {
  /** Nombre accesible del grupo. */
  label: string
  value: T
  options: readonly Segment<T>[]
  onChange: (value: T) => void
}

export function SegmentedControl<T extends string>({ label, value, options, onChange }: SegmentedControlProps<T>) {
  const name = useId()

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex items-stretch gap-0.5 rounded-full border border-white/10 bg-coal-900/70 p-0.5"
    >
      {options.map((option) => (
        // La etiqueta entera es el objetivo táctil: 44 × 44 px como mínimo (plan §9.4).
        <label
          key={option.value}
          lang={option.lang}
          className="relative inline-flex min-h-11 min-w-11 cursor-pointer select-none items-stretch"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            aria-label={option.ariaLabel}
            className="peer sr-only"
          />
          {/* El estado seleccionado y el foco del teclado se dibujan en este elemento visible. */}
          <span className="flex flex-1 items-center justify-center rounded-full px-3 text-[0.9375rem] font-semibold tracking-wide text-ash-300 transition-[background-color,color,transform] duration-120 ease-out-strong peer-checked:bg-coal-700 peer-checked:text-bone-50 peer-checked:shadow-[inset_0_-2px_0_0_var(--color-ember-500)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ember-400 hover:text-bone-50 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  )
}
