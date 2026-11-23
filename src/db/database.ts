import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_SETTINGS, seedMaterials, seedNodes } from '../domain/seed'
import type { CurriculumNode, Material, Note, Project, Review, Session, Settings } from '../domain/types'

export class StudyOpsDatabase extends Dexie {
  nodes!: EntityTable<CurriculumNode, 'id'>
  materials!: EntityTable<Material, 'id'>
  notes!: EntityTable<Note, 'id'>
  sessions!: EntityTable<Session, 'id'>
  settings!: EntityTable<Settings, 'id'>
  projects!: EntityTable<Project, 'id'>
  reviews!: EntityTable<Review, 'id'>

  constructor(name = 'StudyOps') {
    super(name)
    this.version(1).stores({
      nodes: 'id, parentId, kind',
      materials: 'id, subject, type',
      notes: 'id, topicId, sessionId, projectId, updatedAt',
      sessions: 'id, status, nodeId, topicId, startedAt, updatedAt',
      settings: 'id',
      projects: 'id, status, updatedAt',
      reviews: 'id, topicId, dueAt, kind, updatedAt',
    })
  }
}

export const db = new StudyOpsDatabase()

/** The settings record is the seed marker, so intentionally emptied collections stay empty. */
export async function initializeDatabase(database = db) {
  await database.open()
  await database.transaction('rw', [database.settings, database.nodes, database.materials], async () => {
    if (await database.settings.get('local')) return

    await database.nodes.bulkAdd(seedNodes)
    await database.materials.bulkAdd(seedMaterials)
    await database.settings.add(DEFAULT_SETTINGS)
  })
}
