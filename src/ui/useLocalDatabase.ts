import { useEffect, useRef, useState } from 'react'
import type { Session } from '../domain/types'
import { db, initializeDatabase } from '../db/database'
import { recoverRunningSession, touchSession } from '../db/study'

const heartbeatKey = 'studyops:timer-heartbeat'

function writeHeartbeat(id: string, now: number) {
  try { localStorage.setItem(heartbeatKey, JSON.stringify({ id, now })) } catch { /* The periodic IndexedDB write remains active. */ }
}

async function restoreRunningTimer() {
  try {
    const lastHeartbeat = JSON.parse(localStorage.getItem(heartbeatKey) ?? 'null') as { id: string; now: number } | null
    if (lastHeartbeat && typeof lastHeartbeat.id === 'string' && Number.isFinite(lastHeartbeat.now) && lastHeartbeat.now <= Date.now()) {
      await touchSession(lastHeartbeat.id, lastHeartbeat.now)
    }
  } catch {
    // An invalid or unavailable local copy does not prevent recovery from IndexedDB.
  }
  await recoverRunningSession()
}

/** One tab owns the heartbeat so a new tab never pauses another tab's timer. */
export function useLocalDatabase(attempt: number, activeSession: Session | undefined, onError: (message: string) => void) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const owner = useRef(false)
  const currentSession = useRef(activeSession)
  const reportError = useRef(onError)
  useEffect(() => { currentSession.current = activeSession }, [activeSession])
  useEffect(() => { reportError.current = onError }, [onError])

  useEffect(() => {
    let mounted = true
    let cancelQueued: AbortController | undefined
    let releaseOwner = () => {}
    const released = new Promise<void>((resolve) => { releaseOwner = resolve })
    const fail = () => { if (mounted) setStatus('error') }

    async function ownTimer() {
      if (!mounted) return
      await restoreRunningTimer()
      if (!mounted) return
      owner.current = true
      setStatus('ready')
      await released
      owner.current = false
    }

    async function open() {
      setStatus('loading')
      await initializeDatabase()
      if (!mounted) return
      if (!navigator.locks) {
        await ownTimer()
        return
      }
      await navigator.locks.request('studyops-timer', { ifAvailable: true }, async (lock) => {
        if (lock) await ownTimer()
        else if (mounted) setStatus('ready')
      })
      if (!mounted) return
      cancelQueued = new AbortController()
      await navigator.locks.request('studyops-timer', { signal: cancelQueued.signal }, ownTimer)
    }

    void open().catch(fail)
    const heartbeat = () => {
      const session = currentSession.current
      if (!owner.current || !session) return
      const now = Date.now()
      writeHeartbeat(session.id, now)
      void touchSession(session.id, now).catch(() => reportError.current('Não foi possível registrar o tempo. Pause a sessão e tente novamente.'))
    }
    const interval = window.setInterval(heartbeat, 4000)
    window.addEventListener('pagehide', heartbeat)
    document.addEventListener('visibilitychange', heartbeat)
    return () => {
      mounted = false
      cancelQueued?.abort()
      releaseOwner()
      window.clearInterval(interval)
      window.removeEventListener('pagehide', heartbeat)
      document.removeEventListener('visibilitychange', heartbeat)
    }
  }, [attempt])

  return status
}

export function readWorkspace() {
  return db.transaction('r', [db.nodes, db.sessions, db.notes, db.materials, db.settings, db.reviews, db.projects], async () => {
    const [nodes, sessions, notes, materials, settings, reviews, projects] = await Promise.all([
      db.nodes.toArray(), db.sessions.toArray(), db.notes.toArray(), db.materials.toArray(),
      db.settings.get('local'), db.reviews.toArray(), db.projects.toArray(),
    ])
    if (!settings) throw new Error('As configurações locais não estão disponíveis.')
    return { nodes, sessions, notes, materials, settings, reviews, projects }
  })
}
