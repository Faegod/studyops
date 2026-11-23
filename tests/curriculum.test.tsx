// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../src/db/database'
import type { CurriculumNode, Material, Note } from '../src/domain/types'
import CurriculumPage from '../src/features/curriculum/CurriculumPage'

const phase = node('fundamentos', 'phase', null, 'Fundamentos', 0)
const otherPhase = node('redes', 'phase', null, 'Redes', 1)
const material: Material = {
  id: 'material', title: 'Referência de teste', url: 'https://example.com/estudo', source: 'Exemplo',
  type: 'documentação', language: 'pt-BR', difficulty: 'iniciante', subject: 'Fundamentos',
}
const note: Note = {
  id: 'anotacao', title: 'Resumo da aula', content: 'Resumo', tags: [],
  favorite: false, question: false, topicId: 'topico', updatedAt: 1,
}

function node(id: string, kind: CurriculumNode['kind'], parentId: string | null, title: string, order = 0): CurriculumNode {
  return {
    id, kind, parentId, title, order, description: '', status: 'pending', minutes: 15,
    difficulty: 'iniciante', objectives: [], prerequisites: [], materialIds: [],
    weeks: kind === 'phase' ? 4 : undefined,
  }
}

function Trail({ selectedNodeId, onStudy = () => {}, onNotes = () => {} }: {
  selectedNodeId?: string
  onStudy?: (id: string) => void
  onNotes?: (id: string) => void
}) {
  const nodes = useLiveQuery(() => db.nodes.toArray()) ?? []
  return (
    <CurriculumPage nodes={nodes} materials={[material]} notes={[note]} selectedNodeId={selectedNodeId}
      onNotify={() => {}} onStudy={onStudy} onNotes={onNotes} />
  )
}

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal === 'function') return
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false } },
  })
})

beforeEach(async () => {
  await db.transaction('rw', [db.nodes, db.reviews], async () => {
    await db.nodes.clear()
    await db.reviews.clear()
    await db.nodes.bulkAdd([phase, otherPhase])
  })
})

afterEach(cleanup)

describe('Minha Trilha', () => {
  it('cria, edita, reordena e exclui uma fase personalizada e seu curso', async () => {
    const user = userEvent.setup()
    render(<Trail />)
    await screen.findByRole('heading', { name: 'Fundamentos' })

    await user.click(screen.getByRole('button', { name: 'Nova fase' }))
    let dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Título'), 'Prática pessoal')
    await user.clear(dialog.getByLabelText('Semanas previstas'))
    await user.type(dialog.getByLabelText('Semanas previstas'), '6')
    await user.click(dialog.getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('heading', { name: 'Prática pessoal' })

    await user.click(screen.getByRole('button', { name: 'Adicionar disciplina' }))
    dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText('Título'), 'Meu curso de PowerShell')
    await user.click(dialog.getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('button', { name: /^Meu curso de PowerShell/ })

    await user.click(screen.getByLabelText('Opções de Meu curso de PowerShell'))
    await user.click(screen.getByRole('button', { name: 'Editar' }))
    dialog = within(screen.getByRole('dialog'))
    await user.clear(dialog.getByLabelText('Título'))
    await user.type(dialog.getByLabelText('Título'), 'PowerShell na prática')
    await user.click(dialog.getByRole('button', { name: 'Salvar' }))
    await screen.findByRole('button', { name: /^PowerShell na prática/ })

    await user.click(screen.getByLabelText('Opções de Prática pessoal'))
    await user.click(screen.getByRole('button', { name: 'Mover para cima' }))
    const rail = within(screen.getByRole('navigation', { name: 'Fases da formação' }))
    await waitFor(() => expect(rail.getAllByRole('button')[1].textContent).toContain('Prática pessoal'))

    await user.click(screen.getByLabelText('Opções de Prática pessoal'))
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/Itens vinculados/).textContent).toContain('1')
    await user.click(dialog.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('heading', { name: 'Prática pessoal' })).toBeDefined()

    await user.click(screen.getByLabelText('Opções de Prática pessoal'))
    await user.click(screen.getByRole('button', { name: 'Excluir' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' }))
    await waitFor(() => expect(rail.getAllByRole('button')).toHaveLength(2))
    expect((await db.nodes.toArray()).map((item) => item.title).sort()).toEqual(['Fundamentos', 'Redes'])
  })

  it('abre um tópico da rota, mostra detalhes e integra anotações, estudo e conclusão explícita', async () => {
    await db.nodes.bulkAdd([
      node('disciplina', 'discipline', otherPhase.id, 'Redes em casa'),
      node('modulo', 'module', 'disciplina', 'Endereçamento'),
      { ...node('topico', 'topic', 'modulo', 'Entenda o DNS'), objectives: ['Explicar a resolução de nomes'], materialIds: [material.id] },
      node('atividade', 'activity', 'topico', 'Anote a resolução de um nome'),
    ])
    const user = userEvent.setup()
    const onStudy = vi.fn()
    const onNotes = vi.fn()
    render(<Trail selectedNodeId="atividade" onStudy={onStudy} onNotes={onNotes} />)

    await screen.findByRole('heading', { name: 'Redes' })
    expect(screen.getByText('Explicar a resolução de nomes')).toBeDefined()
    expect(screen.getByRole('link', { name: material.title }).getAttribute('href')).toBe(material.url)
    await user.click(screen.getByRole('button', { name: 'Estudar atividade' }))
    await user.click(screen.getByRole('button', { name: 'Anotações (1)' }))
    expect(onStudy).toHaveBeenCalledWith('atividade')
    expect(onNotes).toHaveBeenCalledWith('topico')
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0')

    await user.click(screen.getByRole('button', { name: 'Concluir tópico' }))
    await screen.findByRole('button', { name: 'Reabrir tópico' })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    expect((await db.nodes.get('topico'))?.status).toBe('completed')
  })
})
