import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, importBackup, validateBackup } from '../src/db/backup'
import { db, initializeDatabase } from '../src/db/database'
import {
  deleteNode, deleteNote, finishSession, moveNode, pauseSession, recoverRunningSession,
  resumeSession, saveNode, saveNote, startSession, touchSession, updateSession,
} from '../src/db/study'
import { getElapsedMs, getRecommendation, getStudyTime, getTopicProgress, getWeekRange } from '../src/domain/study'
import type { CurriculumNode } from '../src/domain/types'

const topicId = 'topic-arquitetura'
const start = new Date(2026, 10, 16, 13).getTime()

function newCurriculumItem(kind: CurriculumNode['kind'], parentId: string | null, title: string) {
  return saveNode({
    kind, parentId, title, description: 'Exercício de laboratório', status: 'pending', minutes: 20,
    difficulty: 'iniciante', objectives: ['Registrar uma descoberta'], prerequisites: [], materialIds: [],
  })
}

beforeEach(async () => {
  await db.delete()
  await initializeDatabase()
})

describe('currículo local', () => {
  it('cria as oito fases em ordem e preserva uma fase removida após reabrir a base', async () => {
    const phases = (await db.nodes.where('kind').equals('phase').toArray()).sort((a, b) => a.order - b.order)
    expect(phases.map((phase) => phase.weeks)).toEqual([4, 6, 8, 4, 8, 4, 8, 8])
    expect(getTopicProgress(await db.nodes.toArray())).toEqual({ completed: 0, pending: 32, total: 32 })
    expect(await db.sessions.count()).toBe(0)

    await deleteNode(phases.at(-1)!.id)
    db.close()
    await initializeDatabase()
    expect(await db.nodes.where('kind').equals('phase').count()).toBe(7)
  })

  it('cria, edita, reordena e remove uma trilha própria preservando notas e histórico', async () => {
    const phase = await newCurriculumItem('phase', null, 'Trilha própria')
    const discipline = await newCurriculumItem('discipline', phase.id, 'Laboratório pessoal')
    const module = await newCurriculumItem('module', discipline.id, 'Programação de utilitários')
    const first = await newCurriculumItem('topic', module.id, 'Leitura')
    const second = await newCurriculumItem('topic', module.id, 'Exercício')
    await newCurriculumItem('activity', second.id, 'Treino prático')
    await saveNode({ ...second, title: 'Exploração prática' })
    await moveNode(second.id, -1)
    expect(await db.nodes.get(second.id)).toMatchObject({ order: 0, title: 'Exploração prática' })
    expect(await db.nodes.get(first.id)).toMatchObject({ order: 1 })

    const session = await startSession(second.id, 5)
    const note = await saveNote({
      title: 'Descoberta', content: '**Uma anotação**', topicId: second.id, sessionId: session.id,
      favorite: true, question: false, tags: ['lab', ' lab '],
    })
    await deleteNode(phase.id)
    expect(await db.nodes.get(second.id)).toBeUndefined()
    expect(await db.notes.get(note.id)).toMatchObject({ content: '**Uma anotação**', tags: ['lab'], sessionId: session.id })
    expect((await db.notes.get(note.id))?.topicId).toBeUndefined()
    expect(await db.sessions.get(session.id)).toMatchObject({ title: 'Exploração prática', status: 'paused' })
    await expect(resumeSession(session.id)).rejects.toThrow('removido')
  })

  it('rejeita pais incompatíveis com a hierarquia', async () => {
    await expect(newCurriculumItem('topic', 'phase-fundamentos', 'Tópico inválido')).rejects.toThrow('item pai válido')
  })
})

describe('sessões de estudo', () => {
  it('recupera cronômetro, material, contexto e anotação depois de fechar e reabrir o IndexedDB', async () => {
    const session = await startSession(topicId, 20, start)
    const note = await saveNote({
      title: 'CPU', content: 'Buscar → decodificar → executar', topicId, sessionId: session.id,
      tags: [], favorite: false, question: false,
    })
    await updateSession(session.id, { noteId: note.id })
    await pauseSession(session.id, 'Rever o ciclo de busca.', start + 97_000)

    db.close()
    await initializeDatabase()
    const paused = await db.sessions.get(session.id)
    expect(paused).toMatchObject({
      status: 'paused', elapsedMs: 97_000, checkpoint: 'Rever o ciclo de busca.', noteId: note.id,
      materialId: 'cs50-memory', segments: [{ start, end: start + 97_000 }],
    })
    expect(await db.notes.get(note.id)).toMatchObject({ content: 'Buscar → decodificar → executar' })
    const resumed = await resumeSession(session.id, start + 3_000_000)
    expect(getElapsedMs(resumed, start + 3_010_000)).toBe(107_000)
    const finished = await finishSession(session.id, { now: start + 3_010_000 })
    expect(finished.elapsedMs).toBe(107_000)
    expect((await db.nodes.get(topicId))?.status).toBe('in-progress')
    expect(await db.reviews.count()).toBe(0)
  })

  it('limita o tempo recuperado à última atividade registrada quando o navegador fecha', async () => {
    const session = await startSession(topicId, 10, start)
    await touchSession(session.id, start + 45_000)
    db.close()
    await initializeDatabase()
    await recoverRunningSession(start + 5_000_000)
    expect(await db.sessions.get(session.id)).toMatchObject({ status: 'paused', elapsedMs: 45_000 })
  })

  it('serializa dois inícios concorrentes e programa revisão apenas com conclusão explícita', async () => {
    await Promise.all([
      startSession(topicId, 10, start),
      startSession('topic-representacao', 10, start + 5_000),
    ])
    const running = await db.sessions.where('status').equals('running').toArray()
    expect(running).toHaveLength(1)
    const finished = await finishSession(running[0].id, { now: start + 15_000, completeNode: true })
    await finishSession(running[0].id, { now: start + 25_000, completeNode: true })
    expect(await db.nodes.get(finished.nodeId)).toMatchObject({ status: 'completed' })
    expect(await db.reviews.toArray()).toMatchObject([{ topicId: finished.nodeId, intervalIndex: 0 }])
  })

  it('prioriza retomar, revisar e estudar uma tarefa compatível no tempo disponível', async () => {
    const nodes = await db.nodes.toArray()
    const due = { id: 'review-1', kind: 'pergunta' as const, question: 'O que é CPU?', answer: '', dueAt: start, intervalIndex: 0, updatedAt: start }
    expect(getRecommendation(nodes, [], 5, [due], undefined, start)?.kind).toBe('review')
    expect(getRecommendation(nodes, [], 5, [], undefined, start)).toMatchObject({ kind: 'activity', minutes: 5 })
    expect(getRecommendation(nodes.filter((node) => node.kind !== 'activity'), [], 5, [], undefined, start))
      .toMatchObject({ kind: 'topic', minutes: 5, remainingMinutes: 30 })
    const session = await startSession(topicId, 30, start)
    const paused = await pauseSession(session.id, 'Memória', start + 300_000)
    expect(getRecommendation(nodes, [paused], 5, [due], undefined, start + 300_000))
      .toMatchObject({ kind: 'resume', minutes: 5, remainingMinutes: 25 })
  })

  it('atribui tempo ao período correto quando uma sessão atravessa meia-noite', async () => {
    const { start: monday, end: nextMonday } = getWeekRange(start)
    const session = await startSession(topicId, 5, monday - 30_000)
    const paused = await pauseSession(session.id, undefined, monday + 30_000)
    expect(getStudyTime([paused], monday, nextMonday)).toBe(30_000)
  })
})

describe('caderno', () => {
  it('protege o rascunho mais recente e remove uma anotação explicitamente', async () => {
    const base = { id: 'note', title: 'Conceitos', tags: [], favorite: false, question: false, topicId }
    await saveNote({ ...base, content: '# Rascunho atual', updatedAt: start + 5_000 })
    await saveNote({ ...base, content: 'Anterior', updatedAt: start })
    db.close()
    await initializeDatabase()
    expect(await db.notes.get(base.id)).toMatchObject({ content: '# Rascunho atual' })
    await deleteNote(base.id)
    expect(await db.notes.get(base.id)).toBeUndefined()
  })
})

describe('backup local', () => {
  it('valida o arquivo sem alterar os dados e restaura caderno, trilha e sessões', async () => {
    const session = await startSession(topicId, 30, start)
    await pauseSession(session.id, 'Voltar ao diagrama.', start + 65_000)
    const note = await saveNote({ title: 'Componentes', content: '# CPU', tags: [], favorite: false, question: true, topicId })
    const backup: unknown = JSON.parse(JSON.stringify(await exportBackup()))
    const invalid = structuredClone(validateBackup(backup))
    invalid.data.nodes.find((node) => node.id === topicId)!.parentId = 'inexistente'
    await expect(importBackup(invalid, 'replace')).rejects.toThrow('hierarquia')
    expect(await db.notes.get(note.id)).toMatchObject({ content: '# CPU' })

    await deleteNote(note.id)
    await deleteNode(topicId)
    await importBackup(backup, 'replace')
    db.close()
    await initializeDatabase()
    expect(await db.notes.get(note.id)).toMatchObject({ question: true, topicId })
    expect(await db.sessions.get(session.id)).toMatchObject({ checkpoint: 'Voltar ao diagrama.', elapsedMs: 65_000 })
    expect(await db.nodes.get(topicId)).toMatchObject({ title: 'Arquitetura de computadores' })
  })

  it('mescla por identificador preservando edições locais e progresso do arquivo', async () => {
    const node = (await db.nodes.get(topicId))!
    await saveNode({ ...node, status: 'completed' })
    const note = await saveNote({ title: 'Registrada', content: '# Original', tags: [], favorite: false, question: false })
    const backup = await exportBackup()
    await saveNode({ ...node, title: 'Título personalizado' })
    await saveNote({ ...note, content: '# Atualizada', updatedAt: note.updatedAt + 1_000 })
    const extra = await newCurriculumItem('phase', null, 'Segunda formação')
    await importBackup(backup, 'merge')
    expect(await db.nodes.get(topicId)).toMatchObject({ title: 'Título personalizado', status: 'completed' })
    expect(await db.nodes.get(extra.id)).toMatchObject({ title: 'Segunda formação' })
    expect(await db.notes.get(note.id)).toMatchObject({ content: '# Atualizada' })
    expect(await db.reviews.count()).toBe(1)
  })
})
