// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/database'
import type { CurriculumNode } from '../src/domain/types'
import LibraryPage from '../src/features/resources/LibraryPage'
import ProjectsPage from '../src/features/resources/ProjectsPage'
import ReviewsPage from '../src/features/resources/ReviewsPage'

const topic: CurriculumNode = {
  id: 'topic-test', kind: 'topic', parentId: null, order: 0, title: 'Redes',
  description: '', status: 'pending', minutes: 20, difficulty: 'iniciante', objectives: [], prerequisites: [], materialIds: [],
}
const onNotify = () => {}

function Library() {
  const materials = useLiveQuery(() => db.materials.toArray()) ?? []
  const nodes = useLiveQuery(() => db.nodes.toArray()) ?? []
  return <LibraryPage materials={materials} nodes={nodes} onNotify={onNotify} />
}

function Projects() {
  const projects = useLiveQuery(() => db.projects.toArray()) ?? []
  return <ProjectsPage projects={projects} nodes={[topic]} onNotify={onNotify} />
}

function Reviews() {
  const reviews = useLiveQuery(() => db.reviews.toArray()) ?? []
  return <ReviewsPage reviews={reviews} nodes={[topic]} onNotify={onNotify} />
}

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) { this.open = true },
    })
  }
})

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(cleanup)

describe('Recursos de estudo', () => {
  it('cadastra um material e remove o vínculo ao excluí-lo', async () => {
    const user = userEvent.setup()
    render(<Library />)
    await user.click(screen.getByRole('button', { name: 'Novo material' }))
    let form = within(screen.getByRole('dialog'))
    await user.type(form.getByLabelText('Título'), 'Referência de redes')
    await user.type(form.getByLabelText('URL'), 'https://example.test/redes')
    await user.type(form.getByLabelText('Assunto'), 'Redes')
    await user.click(form.getByRole('button', { name: 'Salvar material' }))
    await screen.findByRole('heading', { name: 'Referência de redes' })
    expect(screen.getByRole('link', { name: 'Abrir material' }).getAttribute('href')).toBe('https://example.test/redes')

    const [material] = await db.materials.toArray()
    await db.nodes.put({ ...topic, materialIds: [material.id] })
    await screen.findByText('1 tópico')
    await user.click(screen.getByRole('button', { name: 'Excluir Referência de redes' }))
    form = within(screen.getByRole('dialog'))
    await user.click(form.getByRole('button', { name: 'Excluir material' }))
    await waitFor(async () => {
      expect(await db.materials.count()).toBe(0)
      expect((await db.nodes.get(topic.id))?.materialIds).toEqual([])
    })
  })

  it('persiste um projeto e acompanha seu checklist', async () => {
    const user = userEvent.setup()
    render(<Projects />)
    await user.click(screen.getByRole('button', { name: 'Novo projeto' }))
    const form = within(screen.getByRole('dialog'))
    await user.type(form.getByLabelText('Título'), 'Mapa da rede')
    await user.type(form.getByLabelText('Objetivo'), 'Entender a rede local')
    await user.click(form.getByRole('button', { name: 'Adicionar tarefa' }))
    await user.type(form.getByLabelText('Tarefa 1'), 'Desenhar a topologia')
    await user.click(form.getByRole('button', { name: 'Salvar projeto' }))
    await user.click(await screen.findByRole('checkbox', { name: 'Desenhar a topologia' }))
    await waitFor(async () => {
      expect(await db.projects.toArray()).toMatchObject([{ title: 'Mapa da rede', tasks: [{ done: true }] }])
    })
  })

  it('registra confiança de um flashcard e calcula a próxima etapa', async () => {
    const user = userEvent.setup()
    render(<Reviews />)
    await user.click(screen.getByRole('button', { name: 'Nova revisão' }))
    let form = within(screen.getByRole('dialog'))
    await user.type(form.getByLabelText('Pergunta'), 'O que significa DNS?')
    await user.type(form.getByLabelText('Resposta'), 'Domain Name System')
    await user.click(form.getByRole('button', { name: 'Salvar revisão' }))
    await screen.findByRole('heading', { name: 'O que significa DNS?' })
    await user.click(screen.getByRole('button', { name: 'Revisar' }))
    form = within(screen.getByRole('dialog'))
    await user.click(form.getByRole('button', { name: 'Mostrar resposta' }))
    expect(form.getByText('Domain Name System')).toBeDefined()
    await user.click(form.getByRole('radio', { name: 'alta' }))
    await user.click(form.getByRole('button', { name: 'Registrar revisão' }))

    const expected = new Date()
    expected.setDate(expected.getDate() + 3)
    expected.setHours(0, 0, 0, 0)
    await waitFor(async () => {
      expect(await db.reviews.toArray()).toMatchObject([{
        question: 'O que significa DNS?', kind: 'flashcard', confidence: 'alta',
        intervalIndex: 1, dueAt: expected.getTime(),
      }])
    })
  })
})
