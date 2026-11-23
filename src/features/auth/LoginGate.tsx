import { useState, type FormEvent, type ReactNode } from 'react'
import { Eye, EyeOff, Layers3, LogIn } from 'lucide-react'
import './auth.css'

const credentialDigest = 'dd04452228aabffee0d6ee6b1719424a4e77eeb435b4272a7efc75c4d36a57a0'
const sessionKey = `studyops:access:${import.meta.env.BASE_URL}`

function readSession() {
  try {
    return sessionStorage.getItem(sessionKey) === 'granted'
  } catch {
    return false
  }
}

function saveSession(granted: boolean) {
  try {
    if (granted) sessionStorage.setItem(sessionKey, 'granted')
    else sessionStorage.removeItem(sessionKey)
  } catch {
    // The app can stay unlocked for this page's lifetime without browser storage.
  }
}

// This check controls only which UI is displayed. The static site's assets are public.
async function checkCredentials(username: string, password: string) {
  const serialized = new TextEncoder().encode(JSON.stringify([username, password]))
  const digest = await crypto.subtle.digest('SHA-256', serialized)
  const hex = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  return hex === credentialDigest
}

interface LoginGateProps {
  children: (onSignOut: () => void) => ReactNode
}

export default function LoginGate({ children }: LoginGateProps) {
  const [unlocked, setUnlocked] = useState(readSession)
  const [showPassword, setShowPassword] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  function signOut() {
    saveSession(false)
    setShowPassword(false)
    setError('')
    setUnlocked(false)
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (checking) return

    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '')
    const password = String(form.get('password') ?? '')
    setChecking(true)
    setError('')
    try {
      if (await checkCredentials(username, password)) {
        saveSession(true)
        setUnlocked(true)
      } else {
        setError('Usuário ou senha incorretos.')
      }
    } catch {
      setError('Não foi possível validar o acesso. Abra o StudyOps por HTTPS e tente novamente.')
    } finally {
      setChecking(false)
    }
  }

  if (unlocked) return children(signOut)

  return (
    <main className="auth-page">
      <section className="auth-card card" aria-labelledby="auth-heading">
        <span className="brand-mark auth-mark" aria-hidden="true"><Layers3 size={23} strokeWidth={2.2} /></span>
        <h1 id="auth-heading">Entre no StudyOps</h1>
        <p className="auth-intro">Acesse seu painel de estudos.</p>

        <form className="auth-form" onSubmit={event => void signIn(event)} aria-busy={checking}>
          <label className="field" htmlFor="studyops-username">
            Usuário
            <input id="studyops-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false}
              required disabled={checking} onChange={() => setError('')} />
          </label>
          <div className="field">
            <label htmlFor="studyops-password">Senha</label>
            <div className="auth-password">
              <input id="studyops-password" name="password" type={showPassword ? 'text' : 'password'}
                autoComplete="current-password" required disabled={checking} onChange={() => setError('')} />
              <button type="button" className="icon-button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                disabled={checking} onClick={() => setShowPassword(visible => !visible)}>
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>
          {error && <p className="error-text" role="alert">{error}</p>}
          <button type="submit" className="button button-primary auth-submit" disabled={checking}>
            <LogIn size={18} aria-hidden="true" />
            {checking ? 'Validando…' : 'Entrar'}
          </button>
        </form>

        <p className="auth-note">A validação do acesso e o progresso ficam neste navegador.</p>
      </section>
    </main>
  )
}
