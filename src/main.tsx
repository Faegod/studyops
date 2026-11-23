import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/manrope/wght.css'
import './styles.css'
import { App } from './App'

const updateApp = registerSW({
  onNeedRefresh: () => window.dispatchEvent(new Event('studyops:update-ready')),
})

createRoot(document.getElementById('root')!).render(<App onUpdate={() => { void updateApp(true) }} />)
