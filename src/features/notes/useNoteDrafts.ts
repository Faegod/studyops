import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Note } from '../../domain/types'
import { deleteNote, saveNote } from '../../db/study'

const draftPrefix = 'studyops:pending-note:'
const pendingWrites = new Map<string, Promise<void>>()

type Draft = {
  note: Note
  status: 'saving' | 'saved' | 'error'
}

function savePendingDraft(note: Note) {
  try {
    localStorage.setItem(draftPrefix + note.id, JSON.stringify(note))
  } catch {
    // IndexedDB remains the main write path when localStorage is unavailable.
  }
}

function removePendingDraft(id: string, updatedAt?: number) {
  try {
    const key = draftPrefix + id
    const value = localStorage.getItem(key)
    if (updatedAt === undefined || (value && JSON.parse(value).updatedAt === updatedAt)) {
      localStorage.removeItem(key)
    }
  } catch {
    // The pending copy is optional and can be safely ignored.
  }
}

function readPendingDrafts(): Note[] {
  const result: Note[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(draftPrefix)) continue
      try {
        const note = JSON.parse(localStorage.getItem(key) ?? 'null') as Note | null
        if (
          note && key === draftPrefix + note.id &&
          typeof note.title === 'string' && typeof note.content === 'string' &&
          typeof note.updatedAt === 'number' && Array.isArray(note.tags) &&
          typeof note.favorite === 'boolean' && typeof note.question === 'boolean'
        ) {
          result.push(note)
        }
      } catch {
        // Ignore malformed records under the draft key.
      }
    }
  } catch {
    // There is nothing to recover if localStorage cannot be read.
  }
  return result
}

/** Commit pending browser drafts before capturing a database backup. */
export async function persistPendingNoteDrafts() {
  await Promise.all(pendingWrites.values())
  for (const note of readPendingDrafts()) {
    await saveNote(note)
    removePendingDraft(note.id, note.updatedAt)
  }
}

/** Forget recovery copies after the user replaces the database. */
export function clearPendingNoteDrafts() {
  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index)
      if (key?.startsWith(draftPrefix)) localStorage.removeItem(key)
    }
  } catch {
    // There are no accessible browser drafts to remove.
  }
}

export function useNoteDrafts(persistedNotes: Note[]) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const currentDrafts = useRef<Record<string, Draft>>({})
  const restored = useRef(false)

  const setDraft = useCallback((id: string, draft?: Draft) => {
    const updated = { ...currentDrafts.current }
    if (draft) updated[id] = draft
    else delete updated[id]
    currentDrafts.current = updated
    setDrafts(updated)
  }, [])

  const write = useCallback((note: Note) => {
    setDraft(note.id, { note, status: 'saving' })
    savePendingDraft(note)

    const priorWrite = pendingWrites.get(note.id) ?? Promise.resolve()
    const nextWrite = priorWrite.then(async () => {
      if (currentDrafts.current[note.id]?.note.updatedAt !== note.updatedAt) return
      try {
        const saved = await saveNote(note)
        removePendingDraft(note.id, note.updatedAt)
        if (currentDrafts.current[note.id]?.note.updatedAt === note.updatedAt) {
          setDraft(note.id, { note: saved, status: 'saved' })
        }
      } catch {
        if (currentDrafts.current[note.id]?.note.updatedAt === note.updatedAt) {
          setDraft(note.id, { note, status: 'error' })
        }
      }
    })
    pendingWrites.set(note.id, nextWrite)
    void nextWrite.then(() => {
      if (pendingWrites.get(note.id) === nextWrite) pendingWrites.delete(note.id)
    })
  }, [setDraft])

  useEffect(() => {
    if (restored.current) return
    restored.current = true
    for (const pending of readPendingDrafts()) {
      const saved = persistedNotes.find((note) => note.id === pending.id)
      if (saved && saved.updatedAt >= pending.updatedAt) {
        removePendingDraft(pending.id, pending.updatedAt)
      } else {
        write(pending)
      }
    }
  }, [persistedNotes, write])

  const notes = useMemo(() => {
    const byId = new Map(persistedNotes.map((note) => [note.id, note]))
    for (const { note, status } of Object.values(drafts)) {
      const saved = byId.get(note.id)
      if (status !== 'saved' || !saved || saved.updatedAt < note.updatedAt) {
        byId.set(note.id, note)
      }
    }
    return [...byId.values()].sort((first, second) => second.updatedAt - first.updatedAt)
  }, [drafts, persistedNotes])

  async function remove(id: string) {
    await pendingWrites.get(id)
    await deleteNote(id)
    removePendingDraft(id)
    setDraft(id)
  }

  return { notes, drafts, write, remove }
}
