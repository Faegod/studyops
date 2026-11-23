import { updateSession } from '../../db/study'

const checkpointKey = (id: string) => `studyops:pending-checkpoint:${id}`
const pending = new Map<string, { text: string }>()
const writes = new Map<string, Promise<void>>()

/** The synchronous draft remains available if the tab closes during the IndexedDB write. */
export function readCheckpoint(id: string, persisted: string) {
  const draft = pending.get(id)
  if (draft) return draft.text
  try {
    return localStorage.getItem(checkpointKey(id)) ?? persisted
  } catch {
    return persisted
  }
}

export function saveCheckpoint(id: string, text: string) {
  const draft = { text }
  pending.set(id, draft)
  try {
    localStorage.setItem(checkpointKey(id), text)
  } catch {
    // IndexedDB remains the primary write path.
  }
  const previous = writes.get(id) ?? Promise.resolve()
  const next = previous.catch(() => {}).then(async () => {
    if (pending.get(id) !== draft) return
    await updateSession(id, { checkpoint: draft.text })
    if (pending.get(id) === draft) {
      pending.delete(id)
      try {
        if (localStorage.getItem(checkpointKey(id)) === draft.text) localStorage.removeItem(checkpointKey(id))
      } catch {
        // There is no local copy to clear when storage is unavailable.
      }
    }
  })
  writes.set(id, next)
  void next.finally(() => { if (writes.get(id) === next) writes.delete(id) }).catch(() => {})
  return next
}

export function clearCheckpoints() {
  pending.clear()
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('studyops:pending-checkpoint:')) localStorage.removeItem(key)
    }
  } catch {
    // IndexedDB is independent of localStorage.
  }
}
