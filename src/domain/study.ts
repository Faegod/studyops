import type { CurriculumNode, Review, Session, Settings } from './types'

export const SESSION_DURATIONS = [5, 10, 20, 30, 60] as const
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30] as const
export const MINUTE_MS = 60_000

export interface Recommendation {
  kind: 'resume' | 'review' | 'activity' | 'topic'
  node?: CurriculumNode
  session?: Session
  review?: Review
  minutes: number
  remainingMinutes?: number
  title: string
  description: string
}

export function flattenCurriculum(nodes: CurriculumNode[]): CurriculumNode[] {
  const groups = new Map<string | null, CurriculumNode[]>()
  for (const node of nodes) {
    const children = groups.get(node.parentId) ?? []
    children.push(node)
    groups.set(node.parentId, children)
  }

  const ordered: CurriculumNode[] = []
  function visit(parentId: string | null) {
    const siblings = groups.get(parentId) ?? []
    siblings.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    for (const child of siblings) {
      ordered.push(child)
      visit(child.id)
    }
  }
  visit(null)
  return ordered
}

export function getRecommendationsOrder(nodes: CurriculumNode[], settings?: Settings) {
  const ordered = flattenCurriculum(nodes)
  const priorities = settings?.priorityIds ?? []
  if (!priorities.length) return ordered

  const byId = new Map(nodes.map((node) => [node.id, node]))
  function rank(node: CurriculumNode): number {
    const index = priorities.indexOf(node.id)
    if (index !== -1) return index
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    return parent ? rank(parent) : priorities.length
  }
  return ordered.sort((a, b) => rank(a) - rank(b))
}

export function getRecommendation(
  nodes: CurriculumNode[],
  sessions: Session[],
  minutes: number,
  reviews: Review[] = [],
  settings?: Settings,
  now = Date.now(),
): Recommendation | null {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const interrupted = sessions
    .filter((session) => session.status !== 'completed' && byId.has(session.nodeId))
    .sort((a, b) => Number(b.status === 'running') - Number(a.status === 'running') || b.updatedAt - a.updatedAt)[0]

  if (interrupted) {
    const remainingMinutes = Math.max(1, interrupted.plannedMinutes - Math.floor(getElapsedMs(interrupted, now) / MINUTE_MS))
    return {
      kind: 'resume',
      node: byId.get(interrupted.nodeId),
      session: interrupted,
      minutes: Math.min(minutes, remainingMinutes),
      remainingMinutes,
      title: interrupted.title,
      description: interrupted.checkpoint || 'Retome a sessão com seus materiais e anotações.',
    }
  }

  const dueReview = reviews
    .filter((review) => review.completedAt === undefined && review.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt)[0]
  if (dueReview && minutes >= 5) {
    return {
      kind: 'review',
      node: dueReview.topicId ? byId.get(dueReview.topicId) : undefined,
      review: dueReview,
      minutes: 5,
      title: dueReview.question,
      description: 'Reserve alguns minutos para recuperar o conteúdo de memória.',
    }
  }

  const ordered = getRecommendationsOrder(nodes, settings)
  const activity = ordered.find((node) =>
    node.kind === 'activity' &&
    node.status !== 'completed' &&
    node.minutes <= minutes &&
    (!node.parentId || byId.get(node.parentId)?.status !== 'completed'),
  )
  const node = activity ?? ordered.find((item) => item.kind === 'topic' && item.status !== 'completed')

  if (!node) return null
  return {
    kind: activity ? 'activity' : 'topic',
    node,
    minutes: Math.min(minutes, node.minutes),
    remainingMinutes: node.minutes,
    title: node.title,
    description: node.description,
  }
}

export function getElapsedMs(session: Session, now = Date.now()) {
  const ongoingTime = session.status === 'running' && session.runStartedAt !== undefined
    ? Math.max(0, now - session.runStartedAt)
    : 0
  return session.elapsedMs + ongoingTime
}

export function stopSessionTimer(session: Session, status: 'paused' | 'completed', now: number): Session {
  const start = session.runStartedAt
  const segments = session.status === 'running' && start !== undefined && now > start
    ? [...session.segments, { start, end: now }]
    : session.segments
  return {
    ...session,
    status,
    segments,
    elapsedMs: getElapsedMs(session, now),
    updatedAt: Math.max(now, session.updatedAt),
    endedAt: status === 'completed' ? now : undefined,
    runStartedAt: undefined,
    heartbeatAt: undefined,
  }
}

export function getStudyTime(sessions: Session[], start: number, end: number, now = Date.now()) {
  const overlap = (segmentStart: number, segmentEnd: number) =>
    Math.max(0, Math.min(segmentEnd, end) - Math.max(segmentStart, start))

  return sessions.reduce((time, session) => {
    const recorded = session.segments.reduce((total, segment) => total + overlap(segment.start, segment.end), 0)
    const running = session.status === 'running' && session.runStartedAt !== undefined
      ? overlap(session.runStartedAt, now)
      : 0
    return time + recorded + running
  }, 0)
}

export function getWeekRange(now = Date.now()) {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const nextMonday = new Date(monday)
  nextMonday.setDate(nextMonday.getDate() + 7)
  return { start: monday.getTime(), end: nextMonday.getTime() }
}

export function getTopicProgress(nodes: CurriculumNode[]) {
  const topics = nodes.filter((node) => node.kind === 'topic')
  const completed = topics.filter((node) => node.status === 'completed').length
  return { completed, pending: topics.length - completed, total: topics.length }
}
