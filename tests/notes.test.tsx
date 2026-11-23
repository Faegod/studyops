// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLiveQuery } from 'dexie-react-hooks'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../src/db/database'
import type { Note } from '../src/domain/types'
import NotesPage from '../src/features/notes/NotesPage'

function Notebook() {
  const notes = useLiveQuery(() => db.notes.toArray())
  return notes ? <NotesPage nodes={[]} notes={notes} sessions={[]} onNotify={() => {}} /> : null
}

beforeEach(async () => {
  localStorage.clear()
  await db.notes.clear()
})

afterEach(cleanup)

describe('Caderno', () => {
  it('edita um título com espaços, renderiza Markdown e permite buscar e excluir', async () => {
    const user = userEvent.setup()
    render(<Notebook />)
    await user.click(await screen.findByRole('button', { name: 'Nova anotação' }))
    const title = screen.getByRole('textbox', { name: 'Título da anotação' })
    await user.clear(title)
    await user.type(title, 'Modelo de rede')
    const body = screen.getByRole('textbox', { name: 'Conteúdo da anotação' })
    fireEvent.change(body, { target: { value: '# DNS\n\n- Servidor\n\n```txt\nconsulta\n```' } })
    const tag = screen.getByRole('textbox', { name: 'Tags separadas por vírgula' })
    await user.type(tag, 'revisão{Enter}')
    await user.click(screen.getByRole('button', { name: 'Favoritar anotação' }))

    await user.click(screen.getByRole('button', { name: 'Prévia' }))
    expect(screen.getByRole('heading', { name: 'DNS' })).toBeDefined()
    expect(screen.getByText('consulta').tagName).toBe('CODE')
    expect(screen.getByText('Servidor').tagName).toBe('LI')

    await waitFor(async () => {
      expect(await db.notes.toArray()).toMatchObject([{ title: 'Modelo de rede', tags: ['revisão'], favorite: true }])
    })
    await user.click(screen.getByRole('button', { name: 'Favoritas' }))
    await user.type(screen.getByRole('searchbox', { name: 'Buscar anotações' }), 'revisao')
    const list = within(screen.getByRole('complementary', { name: 'Lista de anotações' }))
    expect(list.getByRole('button', { name: /Modelo de rede/ })).toBeDefined()

    await user.click(screen.getByRole('button', { name: 'Excluir anotação' }))
    await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Excluir' }))
    await waitFor(async () => expect(await db.notes.count()).toBe(0))
  })

  it('restaura uma edição interrompida mais recente que a última gravação no IndexedDB', async () => {
    const saved: Note = {
      id: 'recuperacao', title: 'Rascunho', content: 'Primeira ideia', tags: [],
      favorite: false, question: false, updatedAt: 1,
    }
    await db.notes.put(saved)
    localStorage.setItem('studyops:pending-note:' + saved.id, JSON.stringify({
      ...saved, content: 'Edição recuperada', updatedAt: 2,
    }))
    render(<Notebook />)
    await screen.findByDisplayValue('Edição recuperada')

    await waitFor(async () => expect(await db.notes.get(saved.id)).toMatchObject({
      content: 'Edição recuperada', updatedAt: 2,
    }))
    expect(localStorage.getItem('studyops:pending-note:' + saved.id)).toBeNull()
  })
})
