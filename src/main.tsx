import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource-variable/inter/wght.css'
import '@fontsource-variable/manrope/wght.css'
import './styles.css'
import { App } from './App'
import LoginGate from './features/auth/LoginGate'

const updateApp = registerSW({
  onNeedRefresh: () => window.dispatchEvent(new Event('studyops:update-ready')),
})

const onUpdate = () => { void updateApp(true) }
const application = import.meta.env.VITE_STUDYOPS_LOGIN === 'true'
  ? <LoginGate>{(onSignOut) => <App onUpdate={onUpdate} onSignOut={onSignOut} />}</LoginGate>
  : <App onUpdate={onUpdate} />

createRoot(document.getElementById('root')!).render(application)
