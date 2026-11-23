export type NodeKind = 'phase' | 'discipline' | 'module' | 'topic' | 'activity'
export type NodeStatus = 'pending' | 'in-progress' | 'completed'
export type Difficulty = 'iniciante' | 'intermediário' | 'avançado'

export interface CurriculumNode {
  id: string
  parentId: string | null
  kind: NodeKind
  order: number
  title: string
  description: string
  status: NodeStatus
  minutes: number
  difficulty: Difficulty
  objectives: string[]
  prerequisites: string[]
  materialIds: string[]
  weeks?: number
}

export interface Material {
  id: string
  title: string
  url: string
  source: string
  type: 'curso' | 'documentação' | 'artigo' | 'livro' | 'vídeo'
  language: string
  difficulty: Difficulty
  subject: string
}

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  favorite: boolean
  question: boolean
  topicId?: string
  sessionId?: string
  projectId?: string
  updatedAt: number
}

export interface Segment {
  start: number
  end: number
}

export interface Session {
  id: string
  nodeId: string
  title: string
  topicId?: string
  plannedMinutes: number
  elapsedMs: number
  status: 'running' | 'paused' | 'completed'
  startedAt: number
  runStartedAt?: number
  heartbeatAt?: number
  updatedAt: number
  endedAt?: number
  checkpoint: string
  materialId?: string
  noteId?: string
  segments: Segment[]
}

export interface Settings {
  id: 'local'
  weeklyGoal: number
  availableDays: number[]
  defaultMinutes: number
  theme: 'light' | 'dark' | 'system'
  notifications: boolean
  shortcuts: boolean
  priorityIds: string[]
}

export interface Project {
  id: string
  title: string
  objective: string
  skills: string[]
  topicIds: string[]
  tasks: { id: string; title: string; done: boolean }[]
  notes: string
  repository?: string
  status: 'planejado' | 'em-andamento' | 'concluído'
  updatedAt: number
}

export interface Review {
  id: string
  topicId?: string
  kind: 'tópico' | 'flashcard' | 'pergunta'
  question: string
  answer: string
  dueAt: number
  intervalIndex: number
  confidence?: 'baixa' | 'média' | 'alta'
  lastReviewedAt?: number
  completedAt?: number
  updatedAt: number
}
