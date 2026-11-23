import { useEffect } from 'react'
import { MINUTE_MS } from '../domain/study'
import type { Session } from '../domain/types'

const message = 'O tempo planejado da sessão terminou.'
const lastNoticeKey = 'studyops:last-timer-notice'
let lastNotice: string | undefined

function rememberNotice(id: string) {
  if (lastNotice === id) return false
  try {
    if (localStorage.getItem(lastNoticeKey) === id) return false
    localStorage.setItem(lastNoticeKey, id)
  } catch {
    // This tab can still show the notice once.
  }
  lastNotice = id
  return true
}

async function systemNotice() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration?.active) await registration.showNotification('StudyOps', { body: message, icon: './studyops-192.png' })
  else new Notification('StudyOps', { body: message })
}

export function useStudyNotice(session: Session | undefined, enabled: boolean, onNotify: (message: string) => void) {
  const id = session?.id
  const runStartedAt = session?.runStartedAt
  const elapsedMs = session?.elapsedMs ?? 0
  const plannedMinutes = session?.plannedMinutes ?? 0

  useEffect(() => {
    if (!enabled || !id || runStartedAt === undefined) return
    const remaining = plannedMinutes * MINUTE_MS - elapsedMs - Math.max(0, Date.now() - runStartedAt)
    const timer = window.setTimeout(() => {
      if (!rememberNotice(id)) return
      onNotify(message)
      void systemNotice().catch(() => {})
    }, Math.max(0, remaining))
    return () => window.clearTimeout(timer)
  }, [elapsedMs, enabled, id, onNotify, plannedMinutes, runStartedAt])
}
