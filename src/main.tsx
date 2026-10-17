import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import './styles/index.css'
import { App } from './app/App'
import { createServices } from './services'
import { installDemoHelpers } from './services/mock/demoHelpers'

// Ayudas de la consola (window.__demo): solo en desarrollo; en producción no se incluyen.
if (import.meta.env.DEV) installDemoHelpers(createServices())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
