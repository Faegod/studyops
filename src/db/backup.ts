import { SESSION_DURATIONS, stopSessionTimer } from '../domain/study'
import type { CurriculumNode, Material, Note, Project, Review, Session, Settings } from '../domain/types'
import { db } from './database'
import { PARENT_KINDS } from './study'

interface BackupData {
  nodes: CurriculumNode[]
  materials: Material[]
  notes: Note[]
  sessions: Session[]
  projects: Project[]
  reviews: Review[]
  settings: Settings
}

export interface StudyOpsBackup {
  format: 'studyops-backup'
  version: 1
  exportedAt: number
  data: BackupData
}

type Entry = Record<string, unknown>

const tables = [db.nodes, db.materials, db.notes, db.sessions, db.projects, db.reviews, db.settings]
const difficulties = ['iniciante', 'intermediário', 'avançado']

function isRecord(value: unknown): value is Entry {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isText(value: unknown): value is string {
  return typeof value === 'string'
}

function isName(value: unknown): value is string {
  return isText(value) && Boolean(value.trim())
}

function isNumber(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
}

function isInteger(value: unknown, max = Number.MAX_SAFE_INTEGER): value is number {
  return isNumber(value, max) && Number.isInteger(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isTextList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isText)
}

function oneOf(value: unknown, choices: readonly string[]) {
  return isText(value) && choices.includes(value)
}

function optional(value: unknown, predicate: (field: unknown) => boolean) {
  return value === undefined || predicate(value)
}

function isLink(value: unknown) {
  if (!isName(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validNode(node: Entry) {
  return oneOf(node.kind, Object.keys(PARENT_KINDS)) && oneOf(node.status, ['pending', 'in-progress', 'completed']) &&
    (node.parentId === null || isName(node.parentId)) && isInteger(node.order) &&
    isName(node.title) && isText(node.description) && oneOf(node.difficulty, difficulties) &&
    isInteger(node.minutes) && (!(node.kind === 'topic' || node.kind === 'activity') || node.minutes > 0) &&
    isTextList(node.objectives) && isTextList(node.prerequisites) && isTextList(node.materialIds) &&
    optional(node.weeks, (weeks) => isInteger(weeks) && weeks > 0)
}

function validMaterial(material: Entry) {
  return isName(material.title) && isLink(material.url) && isText(material.source) &&
    oneOf(material.type, ['curso', 'documentação', 'artigo', 'livro', 'vídeo']) &&
    isText(material.language) && oneOf(material.difficulty, difficulties) && isText(material.subject)
}

function validNote(note: Entry) {
  return isText(note.title) && isText(note.content) && isTextList(note.tags) &&
    isBoolean(note.favorite) && isBoolean(note.question) && isNumber(note.updatedAt) &&
    [note.topicId, note.sessionId, note.projectId].every((ref) => optional(ref, isName))
}

function validSession(session: Entry) {
  return isName(session.nodeId) && isName(session.title) && oneOf(session.status, ['running', 'paused', 'completed']) &&
    isInteger(session.plannedMinutes, 60) && session.plannedMinutes > 0 &&
    isNumber(session.elapsedMs) && isNumber(session.startedAt) && isNumber(session.updatedAt) &&
    (session.status !== 'running' || isNumber(session.runStartedAt)) &&
    [session.runStartedAt, session.heartbeatAt, session.endedAt].every((time) => optional(time, isNumber)) &&
    [session.topicId, session.materialId, session.noteId].every((ref) => optional(ref, isName)) &&
    isText(session.checkpoint) && Array.isArray(session.segments) && session.segments.every((segment: unknown) =>
      isRecord(segment) && isNumber(segment.start) && isNumber(segment.end) && segment.start <= segment.end,
    )
}

function validProject(project: Entry) {
  return isName(project.title) && isText(project.objective) && isTextList(project.skills) && isTextList(project.topicIds) &&
    optional(project.repository, isLink) && oneOf(project.status, ['planejado', 'em-andamento', 'concluído']) &&
    isText(project.notes) && isNumber(project.updatedAt) && Array.isArray(project.tasks) &&
    project.tasks.every((task: unknown) =>
      isRecord(task) && isName(task.id) && isName(task.title) && isBoolean(task.done),
    )
}

function validReview(review: Entry) {
  return oneOf(review.kind, ['tópico', 'flashcard', 'pergunta']) && isName(review.question) &&
    isText(review.answer) && isNumber(review.dueAt) && isInteger(review.intervalIndex) && isNumber(review.updatedAt) &&
    optional(review.topicId, isName) && optional(review.confidence, (value) => oneOf(value, ['baixa', 'média', 'alta'])) &&
    [review.lastReviewedAt, review.completedAt].every((time) => optional(time, isNumber))
}

function validSettings(settings: unknown) {
  return isRecord(settings) && settings.id === 'local' && isNumber(settings.weeklyGoal, 168) &&
    Array.isArray(settings.availableDays) && settings.availableDays.every((day: unknown) => isInteger(day, 6)) &&
    SESSION_DURATIONS.some((minutes) => minutes === settings.defaultMinutes) &&
    oneOf(settings.theme, ['light', 'dark', 'system']) && isBoolean(settings.notifications) &&
    isBoolean(settings.shortcuts) && isTextList(settings.priorityIds)
}

function validateEntries(value: unknown, label: string, validate: (entry: Entry) => boolean) {
  if (!Array.isArray(value)) throw new Error(`Seção ausente ou inválida: ${label}.`)
  const ids = new Set<string>()
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry) || !isName(entry.id) || ids.has(entry.id) || !validate(entry)) {
      throw new Error(`Registro inválido em ${label} na posição ${index + 1}.`)
    }
    ids.add(entry.id)
  }
}

function validateHierarchy(nodes: CurriculumNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    const expectedParent = PARENT_KINDS[node.kind]
    const actualParent = node.parentId === null ? null : byId.get(node.parentId)?.kind
    if (actualParent !== expectedParent) throw new Error(`A hierarquia da trilha está inválida em “${node.title}”.`)
  }
}

export function validateBackup(input: unknown): StudyOpsBackup {
  if (!isRecord(input) || input.format !== 'studyops-backup' || input.version !== 1 ||
    !isNumber(input.exportedAt) || !isRecord(input.data)) {
    throw new Error('Selecione um arquivo JSON de backup do StudyOps, versão 1.')
  }
  const { data } = input
  validateEntries(data.nodes, 'trilha', validNode)
  validateEntries(data.materials, 'biblioteca', validMaterial)
  validateEntries(data.notes, 'caderno', validNote)
  validateEntries(data.sessions, 'sessões', validSession)
  validateEntries(data.projects, 'projetos', validProject)
  validateEntries(data.reviews, 'revisões', validReview)
  if (!validSettings(data.settings)) throw new Error('Os dados de configurações são inválidos.')
  const backup = input as unknown as StudyOpsBackup
  validateHierarchy(backup.data.nodes)
  return backup
}

async function readData(): Promise<BackupData> {
  const [nodes, materials, notes, sessions, projects, reviews, settings] = await Promise.all([
    db.nodes.toArray(), db.materials.toArray(), db.notes.toArray(), db.sessions.toArray(),
    db.projects.toArray(), db.reviews.toArray(), db.settings.get('local'),
  ])
  if (!settings) throw new Error('O armazenamento do StudyOps ainda não está inicializado.')
  return { nodes, materials, notes, sessions, projects, reviews, settings }
}

function pauseSnapshot(session: Session, end: number): Session {
  return session.status === 'running' ? stopSessionTimer(session, 'paused', end) : session
}

export async function exportBackup(): Promise<StudyOpsBackup> {
  return db.transaction('r', tables, async () => {
    const data = await readData()
    const exportedAt = Date.now()
    return {
      format: 'studyops-backup',
      version: 1,
      exportedAt,
      data: { ...data, sessions: data.sessions.map((session) => pauseSnapshot(session, exportedAt)) },
    }
  })
}

function mergeById<T extends { id: string }>(existing: T[], incoming: T[], resolve: (local: T, restored: T) => T): T[] {
  const byId = new Map(existing.map((item) => [item.id, item]))
  for (const item of incoming) {
    const local = byId.get(item.id)
    byId.set(item.id, local ? resolve(local, item) : item)
  }
  return [...byId.values()]
}

function keepNewer<T extends { updatedAt: number }>(local: T, restored: T) {
  return restored.updatedAt > local.updatedAt ? restored : local
}

function mergeData(local: BackupData, restored: BackupData): BackupData {
  const progress = { pending: 0, 'in-progress': 1, completed: 2 }
  return {
    nodes: mergeById(local.nodes, restored.nodes, (existing, incoming) => ({
      ...existing,
      status: progress[incoming.status] > progress[existing.status] ? incoming.status : existing.status,
    })),
    materials: mergeById(local.materials, restored.materials, (existing) => existing),
    notes: mergeById(local.notes, restored.notes, keepNewer),
    sessions: mergeById(local.sessions, restored.sessions, (existing, incoming) =>
      existing.status === 'running' ? existing : keepNewer(existing, incoming),
    ),
    projects: mergeById(local.projects, restored.projects, keepNewer),
    reviews: mergeById(local.reviews, restored.reviews, keepNewer),
    settings: local.settings,
  }
}

/** Validate before touching any data and apply every collection in one transaction. */
export async function importBackup(input: unknown, mode: 'replace' | 'merge') {
  const content = validateBackup(input).data
  const restored = {
    ...content,
    sessions: content.sessions.map((session) =>
      pauseSnapshot(session, session.heartbeatAt ?? session.runStartedAt ?? session.updatedAt),
    ),
  }

  await db.transaction('rw', tables, async () => {
    const data = mode === 'merge' ? mergeData(await readData(), restored) : restored
    validateHierarchy(data.nodes)
    if (mode === 'replace') await Promise.all(tables.map((table) => table.clear()))
    await Promise.all([
      db.nodes.bulkPut(data.nodes), db.materials.bulkPut(data.materials), db.notes.bulkPut(data.notes),
      db.sessions.bulkPut(data.sessions), db.projects.bulkPut(data.projects), db.reviews.bulkPut(data.reviews),
      db.settings.put(data.settings),
    ])
  })
}
