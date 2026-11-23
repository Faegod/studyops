import { DEFAULT_SETTINGS } from '../domain/seed'
import { REVIEW_INTERVALS, SESSION_DURATIONS, stopSessionTimer } from '../domain/study'
import type { CurriculumNode, NodeKind, Note, Review, Session, Settings } from '../domain/types'
import { db } from './database'

export const PARENT_KINDS: Record<NodeKind, NodeKind | null> = {
  phase: null,
  discipline: 'phase',
  module: 'discipline',
  topic: 'module',
  activity: 'topic',
}

type NodeInput = Omit<CurriculumNode, 'id' | 'order'> & { id?: string }
type NoteInput = Omit<Note, 'id' | 'updatedAt'> & { id?: string; updatedAt?: number }
type SessionDetails = Pick<Session, 'checkpoint' | 'materialId' | 'noteId'>

function requiredText(text: string, message: string) {
  const value = text.trim()
  if (!value) throw new Error(message)
  return value
}

function siblingsOf(parentId: string | null) {
  return parentId === null
    ? db.nodes.where('kind').equals('phase').toArray()
    : db.nodes.where('parentId').equals(parentId).toArray()
}

async function scheduleFirstReview(node: CurriculumNode, now: number) {
  if (node.kind !== 'topic' || node.status !== 'completed') return

  const id = `topic-${node.id}`
  if (await db.reviews.get(id)) return
  const due = new Date(now)
  due.setDate(due.getDate() + REVIEW_INTERVALS[0])
  const review: Review = {
    id, topicId: node.id, kind: 'tópico',
    question: `O que você consegue explicar sobre ${node.title}?`,
    answer: '', dueAt: due.getTime(), intervalIndex: 0, updatedAt: now,
  }
  await db.reviews.add(review)
}

export async function saveNode(input: NodeInput) {
  const title = requiredText(input.title, 'Digite um título para o item da trilha.')
  if (!Number.isInteger(input.minutes) || input.minutes < 0 || (['topic', 'activity'].includes(input.kind) && input.minutes < 1)) {
    throw new Error('Informe uma duração válida em minutos.')
  }
  if (input.weeks !== undefined && (!Number.isInteger(input.weeks) || input.weeks < 1)) {
    throw new Error('Informe um número positivo de semanas.')
  }

  return db.transaction('rw', [db.nodes, db.reviews], async () => {
    const existing = input.id ? await db.nodes.get(input.id) : undefined
    if (existing && existing.kind !== input.kind) throw new Error('O tipo do item da trilha já foi definido.')

    const expectedParent = PARENT_KINDS[input.kind]
    const parent = input.parentId ? await db.nodes.get(input.parentId) : undefined
    if ((expectedParent === null && input.parentId !== null) || (expectedParent !== null && parent?.kind !== expectedParent)) {
      throw new Error('Selecione um item pai válido para esta etapa da trilha.')
    }

    const siblingOrder = existing?.parentId === input.parentId
      ? existing.order
      : Math.max(-1, ...(await siblingsOf(input.parentId)).map((node) => node.order)) + 1
    const node: CurriculumNode = { ...input, title, id: input.id ?? crypto.randomUUID(), order: siblingOrder }
    await db.nodes.put(node)
    if (existing?.status !== 'completed') await scheduleFirstReview(node, Date.now())
    return node
  })
}

export async function moveNode(id: string, direction: -1 | 1) {
  await db.transaction('rw', db.nodes, async () => {
    const node = await db.nodes.get(id)
    if (!node) return

    const siblings = (await siblingsOf(node.parentId)).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    const index = siblings.findIndex((item) => item.id === id)
    const swapped = siblings[index + direction]
    if (!swapped) return
    siblings[index + direction] = node
    siblings[index] = swapped
    await db.nodes.bulkPut(siblings.map((item, order) => ({ ...item, order })))
  })
}

function descendantIds(nodes: CurriculumNode[], id: string): Set<string> {
  const ids = new Set<string>([id])
  const pending = [id]
  for (const parent of pending) {
    for (const node of nodes) {
      if (node.parentId === parent && !ids.has(node.id)) {
        ids.add(node.id)
        pending.push(node.id)
      }
    }
  }
  return ids
}

export async function deleteNode(id: string) {
  await db.transaction('rw', [db.nodes, db.notes, db.sessions, db.reviews, db.projects, db.settings], async () => {
    const ids = descendantIds(await db.nodes.toArray(), id)
    const matches = (reference?: string) => reference !== undefined && ids.has(reference)
    const now = Date.now()

    await db.nodes.bulkDelete([...ids])
    await db.notes.filter((note) => matches(note.topicId)).modify((note) => { delete note.topicId })
    await db.reviews.filter((review) => matches(review.topicId)).modify((review) => { delete review.topicId })
    await db.sessions.filter((session) => matches(session.topicId) || matches(session.nodeId)).modify((session) => {
      if (matches(session.topicId)) delete session.topicId
      if (session.status === 'running' && matches(session.nodeId)) {
        Object.assign(session, stopSessionTimer(session, 'paused', now))
      }
    })
    await db.projects.toCollection().modify((project) => {
      project.topicIds = project.topicIds.filter((topicId) => !ids.has(topicId))
    })
    const settings = await db.settings.get('local')
    if (settings) await db.settings.update('local', { priorityIds: settings.priorityIds.filter((nodeId) => !ids.has(nodeId)) })
  })
}

async function findSession(id: string) {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Esta sessão não está disponível.')
  return session
}

async function pauseOtherTimers(now: number, exceptId?: string) {
  const running = await db.sessions.where('status').equals('running').toArray()
  const stopped = running
    .filter((session) => session.id !== exceptId)
    .map((session) => stopSessionTimer(session, 'paused', now))
  if (stopped.length) await db.sessions.bulkPut(stopped)
}

export async function startSession(nodeId: string, minutes: number, now = Date.now()) {
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 60) throw new Error('Escolha uma sessão de até 60 minutos.')

  return db.transaction('rw', [db.sessions, db.nodes], async () => {
    const node = await db.nodes.get(nodeId)
    if (!node || (node.kind !== 'activity' && node.kind !== 'topic')) {
      throw new Error('Selecione um tópico ou uma atividade disponível.')
    }
    const running = await db.sessions.where('nodeId').equals(nodeId).filter((session) => session.status === 'running').first()
    if (running) return running

    await pauseOtherTimers(now)
    const topic = node.kind === 'topic' ? node : await db.nodes.get(node.parentId ?? '')
    const session: Session = {
      id: crypto.randomUUID(),
      nodeId: node.id,
      topicId: topic?.id,
      title: node.title,
      plannedMinutes: minutes,
      elapsedMs: 0,
      status: 'running',
      startedAt: now,
      runStartedAt: now,
      heartbeatAt: now,
      updatedAt: now,
      checkpoint: '',
      materialId: node.materialIds[0] ?? topic?.materialIds[0],
      segments: [],
    }
    await db.sessions.add(session)
    const pending = [node, node.id === topic?.id ? undefined : topic].filter((item) => item?.status === 'pending')
    for (const item of pending) if (item) await db.nodes.update(item.id, { status: 'in-progress' })
    return session
  })
}

export async function pauseSession(id: string, checkpoint?: string, now = Date.now()) {
  return db.transaction('rw', db.sessions, async () => {
    const session = await findSession(id)
    if (session.status === 'completed') return session

    const paused = stopSessionTimer(session, 'paused', now)
    if (checkpoint !== undefined) paused.checkpoint = checkpoint
    await db.sessions.put(paused)
    return paused
  })
}

export async function resumeSession(id: string, now = Date.now()) {
  return db.transaction('rw', [db.sessions, db.nodes], async () => {
    const session = await findSession(id)
    if (session.status === 'running') return session
    if (session.status === 'completed') throw new Error('Esta sessão já foi finalizada.')
    if (!await db.nodes.get(session.nodeId)) throw new Error('O item desta sessão foi removido da trilha.')

    await pauseOtherTimers(now)
    const resumed: Session = { ...session, status: 'running', runStartedAt: now, heartbeatAt: now, updatedAt: now }
    await db.sessions.put(resumed)
    return resumed
  })
}

export async function updateSession(id: string, changes: Partial<SessionDetails>) {
  return db.transaction('rw', db.sessions, async () => {
    const session = await findSession(id)
    const updated = { ...session, ...changes, updatedAt: Date.now() }
    await db.sessions.put(updated)
    return updated
  })
}

export async function touchSession(id: string, now = Date.now()) {
  await db.transaction('rw', db.sessions, async () => {
    const session = await db.sessions.get(id)
    if (session?.status === 'running' && now > (session.heartbeatAt ?? session.runStartedAt ?? now)) {
      await db.sessions.update(id, { heartbeatAt: now })
    }
  })
}

/** When reopening a running timer, preserve only the browser's last recorded interval. */
export async function recoverRunningSession(now = Date.now()) {
  return db.transaction('rw', db.sessions, async () => {
    const running = await db.sessions.where('status').equals('running').toArray()
    const recovered = running.map((session) => {
      const end = Math.min(now, session.heartbeatAt ?? session.runStartedAt ?? now)
      return stopSessionTimer(session, 'paused', end)
    })
    if (recovered.length) await db.sessions.bulkPut(recovered)
    return recovered
  })
}

export async function finishSession(
  id: string,
  { completeNode = false, checkpoint, now = Date.now() }: { completeNode?: boolean; checkpoint?: string; now?: number } = {},
) {
  return db.transaction('rw', [db.sessions, db.nodes, db.reviews], async () => {
    const session = await findSession(id)
    if (session.status === 'completed') return session

    const completed = stopSessionTimer(session, 'completed', now)
    if (checkpoint !== undefined) completed.checkpoint = checkpoint
    await db.sessions.put(completed)
    if (completeNode) {
      const node = await db.nodes.get(session.nodeId)
      if (node && node.status !== 'completed') {
        await db.nodes.update(node.id, { status: 'completed' })
        await scheduleFirstReview({ ...node, status: 'completed' }, now)
      }
    }
    return completed
  })
}

export async function saveNote(input: NoteInput) {
  const note: Note = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))],
    updatedAt: input.updatedAt ?? Date.now(),
  }
  return db.transaction('rw', db.notes, async () => {
    const existing = await db.notes.get(note.id)
    if (existing && existing.updatedAt > note.updatedAt) return existing
    await db.notes.put(note)
    return note
  })
}

export async function deleteNote(id: string) {
  await db.transaction('rw', [db.notes, db.sessions], async () => {
    await db.notes.delete(id)
    await db.sessions.filter((session) => session.noteId === id).modify((session) => { delete session.noteId })
  })
}

export async function saveSettings(partial: Partial<Omit<Settings, 'id'>>) {
  return db.transaction('rw', db.settings, async () => {
    const current = await db.settings.get('local') ?? DEFAULT_SETTINGS
    const settings: Settings = { ...current, ...partial }
    if (!Number.isFinite(settings.weeklyGoal) || settings.weeklyGoal < 0 || settings.weeklyGoal > 168) {
      throw new Error('Informe uma meta semanal entre 0 e 168 horas.')
    }
    if (!SESSION_DURATIONS.some((minutes) => minutes === settings.defaultMinutes)) {
      throw new Error('Escolha uma duração padrão disponível.')
    }
    settings.availableDays = [...new Set(settings.availableDays)].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    settings.priorityIds = [...new Set(settings.priorityIds)]
    await db.settings.put(settings)
    return settings
  })
}
