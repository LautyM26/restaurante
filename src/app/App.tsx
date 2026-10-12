import { RESTAURANT } from '../config'
import { LanguageToggle } from '../features/layout/LanguageToggle'
import { I18nProvider, useI18n } from '../i18n/I18nContext'

// Contenido provisorio de T4: marca, selector de idioma y un texto traducido para ver el cambio.
// T5 reemplaza esto por CustomerApp (TopBar con el selector, mesa y navegación) y suma el resto de providers.
function ProvisionalScreen() {
  const { t } = useI18n()
  return (
    <main className="px-4 pt-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-5xl font-extrabold uppercase">{RESTAURANT.name}</h1>
        <LanguageToggle />
      </div>
      <p className="mt-4 max-w-prose text-ash-300">{t('hero.subtitle')}</p>
    </main>
  )
}

export function App() {
  return (
    <I18nProvider>
      <ProvisionalScreen />
    </I18nProvider>
  )
}
