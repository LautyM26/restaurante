// Selector de idioma (RF34): español o inglés. Las opciones muestran ES / EN para que quepan en la
// barra superior; su nombre accesible es el nombre del idioma en ese mismo idioma ("endónimo").
import type { Lang } from '../../domain/types'
import { useI18n } from '../../i18n/I18nContext'
import { SegmentedControl } from '../../ui/SegmentedControl'
import type { Segment } from '../../ui/SegmentedControl'

const LANGUAGE_OPTIONS: readonly Segment<Lang>[] = [
  { value: 'es', label: 'ES', ariaLabel: 'Español', lang: 'es' },
  { value: 'en', label: 'EN', ariaLabel: 'English', lang: 'en' },
]

export function LanguageToggle() {
  const { lang, setLang, t } = useI18n()
  return <SegmentedControl label={t('lang.label')} value={lang} options={LANGUAGE_OPTIONS} onChange={setLang} />
}
