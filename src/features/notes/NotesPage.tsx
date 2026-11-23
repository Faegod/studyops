import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bold, BookOpen, Check, CircleHelp, Code2, Eye, FileText, Link2, List,
  NotebookPen, PencilLine, Plus, Search, Star, Trash2, X,
} from 'lucide-react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { CurriculumNode, Note, Project, Session } from '../../domain/types'
import { PageHeading } from '../../ui/components'
import { useNoteDrafts } from './useNoteDrafts'
import './notes.css'

type NotesPageProps = {
  nodes: CurriculumNode[]
  notes: Note[]
  sessions: Session[]
  projects?: Project[]
  topicId?: string
  sessionId?: string
  selectedNoteId?: string
  onNotify: (message: string) => void
}

type Filter = 'all' | 'favorites' | 'questions'

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'favorites', label: 'Favoritas' },
  { value: 'questions', label: 'Dúvidas' },
]

const editTools = [
  { icon: Bold, label: 'Negrito', start: '**', end: '**', placeholder: 'texto' },
  { icon: List, label: 'Lista', start: '\n- ', end: '\n', placeholder: 'item' },
  { icon: Code2, label: 'Bloco de código', start: '\n```\n', end: '\n```\n', placeholder: 'código' },
  { icon: Link2, label: 'Link', start: '[', end: '](https://)', placeholder: 'link' },
]

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' })

function searchable(value: string) {
  return value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

export function NotesMarkdown({ content }: { content: string }) {
  return (
    <div className="study-notes-markdown">
      <Markdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={['img']}
        components={{ a: (props) => {
          const { node: _node, ...link } = props
          return <a {...link} target="_blank" rel="noopener noreferrer" />
        } }}
      >
        {content}
      </Markdown>
    </div>
  )
}

export default function NotesPage({
  nodes, notes: savedNotes, sessions, projects = [],
  topicId, sessionId, selectedNoteId, onNotify,
}: NotesPageProps) {
  const { notes, drafts, write, remove } = useNoteDrafts(savedNotes)
  const [selectedId, setSelectedId] = useState(selectedNoteId)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [preview, setPreview] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const titleInput = useRef<HTMLInputElement>(null)
  const topics = useMemo(() => nodes.filter((node) => node.kind === 'topic'), [nodes])
  const topicNames = useMemo(() => new Map(topics.map((topic) => [topic.id, topic.title])), [topics])
  const sessionNames = useMemo(() => new Map(sessions.map((session) => [session.id, session.title])), [sessions])
  const projectNames = useMemo(() => new Map(projects.map((project) => [project.id, project.title])), [projects])

  useEffect(() => {
    setSelectedId(selectedNoteId)
    setConfirmDelete(false)
    setPreview(false)
    setTagInput('')
  }, [selectedNoteId, topicId, sessionId])

  const normalizedQuery = searchable(query.trim())
  const visibleNotes = notes.filter((note) => {
    if (filter === 'favorites' && !note.favorite) return false
    if (filter === 'questions' && !note.question) return false
    if (!normalizedQuery) return true
    return searchable([
      note.title, note.content, ...note.tags,
      note.topicId ? topicNames.get(note.topicId) : undefined,
      note.sessionId ? sessionNames.get(note.sessionId) : undefined,
      note.projectId ? projectNames.get(note.projectId) : undefined,
    ].join(' ')).includes(normalizedQuery)
  })
  const contextualNote = sessionId
    ? visibleNotes.find((note) => note.sessionId === sessionId)
    : visibleNotes.find((note) => topicId && note.topicId === topicId)
  const activeNote = selectedId
    ? notes.find((note) => note.id === selectedId)
    : contextualNote ?? (topicId || sessionId ? undefined : visibleNotes[0])
  const activeDraft = activeNote ? drafts[activeNote.id] : undefined

  function selectNote(id?: string) {
    setSelectedId(id)
    setConfirmDelete(false)
    setPreview(false)
    setTagInput('')
  }

  function createNote() {
    const id = crypto.randomUUID()
    write({
      id,
      title: 'Nova anotação',
      content: '',
      tags: [],
      favorite: filter === 'favorites',
      question: filter === 'questions',
      topicId,
      sessionId,
      updatedAt: Date.now(),
    })
    setQuery('')
    selectNote(id)
    requestAnimationFrame(() => {
      titleInput.current?.focus()
      titleInput.current?.select()
    })
  }

  function update(patch: Partial<Note>) {
    if (!activeNote || deleting) return
    write({ ...activeNote, ...patch, updatedAt: Math.max(Date.now(), activeNote.updatedAt + 1) })
  }

  function addTags() {
    if (!activeNote) return
    const tags = [...new Set([...activeNote.tags, ...tagInput.split(',').map((tag) => tag.trim()).filter(Boolean)])]
    if (tags.length !== activeNote.tags.length) update({ tags })
    setTagInput('')
  }

  function insertMarkdown(start: string, end: string, placeholder: string) {
    if (!editor.current || !activeNote) return
    const { selectionStart, selectionEnd } = editor.current
    const content = activeNote.content
    const text = content.slice(selectionStart, selectionEnd) || placeholder
    update({ content: content.slice(0, selectionStart) + start + text + end + content.slice(selectionEnd) })
    requestAnimationFrame(() => {
      editor.current?.focus()
      const first = selectionStart + start.length
      editor.current?.setSelectionRange(first, first + text.length)
    })
  }

  async function confirmRemoval() {
    if (!activeNote || deleting) return
    setDeleting(true)
    try {
      await remove(activeNote.id)
      selectNote()
      onNotify('Anotação excluída.')
    } catch {
      onNotify('Não foi possível excluir a anotação. Tente novamente.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <section className="study-notes">
      <PageHeading title="Caderno" description="Organize descobertas, registre dúvidas e encontre suas anotações."
        action={<button className="button button-primary" onClick={createNote}><Plus size={18} /> Nova anotação</button>} />

      <div className="study-notes-grid">
        <aside className="card study-notes-library" aria-label="Lista de anotações">
          <label className="study-notes-search">
            <Search size={17} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar anotações…" aria-label="Buscar anotações" />
          </label>
          <div className="study-notes-filters" aria-label="Filtrar anotações">
            {filters.map(({ value, label }) => (
              <button key={value} aria-pressed={filter === value} onClick={() => {
                setFilter(value)
                selectNote()
              }}>
                {label}
              </button>
            ))}
          </div>

          {visibleNotes.length ? (
            <ul className="study-notes-list">
              {visibleNotes.map((note) => {
                const subject = note.topicId ? topicNames.get(note.topicId) : undefined
                return (
                  <li key={note.id}>
                    <button className="study-notes-list-entry" aria-current={activeNote?.id === note.id}
                      onClick={() => selectNote(note.id)}>
                      <FileText size={17} className="study-notes-list-icon" />
                      <span>
                        <strong>{note.title.trim() || 'Sem título'}</strong>
                        <small>{subject || note.content.replace(/\s+/g, ' ').trim() || 'Anotação em branco'}</small>
                        <time dateTime={new Date(note.updatedAt).toISOString()}>{shortDate.format(note.updatedAt)}</time>
                      </span>
                      {note.favorite && <Star size={14} className="study-notes-favorite" aria-label="Favorita" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : <p className="study-notes-list-empty">
            {query ? 'Nenhuma anotação corresponde à pesquisa.' : 'Nenhuma anotação nesta seleção.'}
          </p>}
        </aside>

        <div className="card study-notes-editor">
          {activeNote ? (
            <>
              <div className="study-notes-editor-top">
                <input className="study-notes-title" aria-label="Título da anotação" placeholder="Sem título"
                  ref={titleInput} value={activeNote.title} disabled={deleting}
                  onChange={(event) => update({ title: event.target.value })} />
                <div className="study-notes-editor-actions">
                  <button className="icon-button" type="button" title="Favoritar anotação"
                    aria-label="Favoritar anotação" aria-pressed={activeNote.favorite} disabled={deleting}
                    onClick={() => update({ favorite: !activeNote.favorite })}>
                    <Star size={18} fill={activeNote.favorite ? 'currentColor' : 'none'} />
                  </button>
                  <button className="icon-button" type="button" title="Marcar como dúvida pendente"
                    aria-label="Marcar como dúvida pendente" aria-pressed={activeNote.question} disabled={deleting}
                    onClick={() => update({ question: !activeNote.question })}>
                    <CircleHelp size={18} />
                  </button>
                  <button className="icon-button study-notes-delete" type="button"
                    title="Excluir anotação" aria-label="Excluir anotação" disabled={deleting}
                    onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              {confirmDelete && (
                <div className="study-notes-confirm" role="alert">
                  <span>Excluir esta anotação?</span>
                  <button className="button button-secondary" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancelar</button>
                  <button className="button button-secondary study-notes-delete" disabled={deleting} onClick={() => void confirmRemoval()}>Excluir</button>
                </div>
              )}

              <div className="study-notes-tags">
                {activeNote.tags.map((tag) => (
                  <span className="study-notes-tag" key={tag}>{tag}
                    <button aria-label={'Remover tag ' + tag} disabled={deleting}
                      onClick={() => update({ tags: activeNote.tags.filter((item) => item !== tag) })}><X size={13} /></button>
                  </span>
                ))}
                <form onSubmit={(event) => { event.preventDefault(); addTags() }}>
                  <input aria-label="Tags separadas por vírgula" placeholder="Adicionar tag…" disabled={deleting}
                    value={tagInput} onChange={(event) => setTagInput(event.target.value)} />
                  <button aria-label="Adicionar tag" disabled={!tagInput.trim() || deleting}><Plus size={15} /></button>
                </form>
              </div>

              <div className="study-notes-writing">
                <div className="study-notes-toolbar">
                  <div className="study-notes-view-tabs" aria-label="Exibição da anotação">
                    <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}><PencilLine size={15} /> Editar</button>
                    <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}><Eye size={15} /> Prévia</button>
                  </div>
                  {!preview && (
                    <div className="study-notes-formatting" aria-label="Formatação Markdown">
                      {editTools.map(({ icon: Icon, label, start, end, placeholder }) => (
                        <button className="icon-button" type="button" key={label} aria-label={label} title={label}
                          disabled={deleting} onClick={() => insertMarkdown(start, end, placeholder)}>
                          <Icon size={17} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {preview ? (
                  <div className="study-notes-preview">
                    {activeNote.content.trim()
                      ? <NotesMarkdown content={activeNote.content} />
                      : <p className="study-notes-placeholder">Escreva algo para ver a prévia.</p>}
                  </div>
                ) : (
                  <textarea ref={editor} aria-label="Conteúdo da anotação" value={activeNote.content}
                    placeholder="Escreva suas anotações em Markdown…" disabled={deleting}
                    onChange={(event) => update({ content: event.target.value })} />
                )}
              </div>

              <details className="study-notes-associations" open={Boolean(topicId || sessionId) || undefined}>
                <summary><Link2 size={15} /> Associar anotação</summary>
                <div className="study-notes-association-fields">
                  <label>Tópico
                    <select value={activeNote.topicId ?? ''} disabled={deleting}
                      onChange={(event) => update({ topicId: event.target.value || undefined })}>
                      <option value="">Nenhum</option>
                      {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                    </select>
                  </label>
                  <label>Sessão
                    <select value={activeNote.sessionId ?? ''} disabled={deleting}
                      onChange={(event) => update({ sessionId: event.target.value || undefined })}>
                      <option value="">Nenhuma</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>{session.title} · {shortDate.format(session.startedAt)}</option>
                      ))}
                    </select>
                  </label>
                  <label>Projeto
                    <select value={activeNote.projectId ?? ''} disabled={deleting}
                      onChange={(event) => update({ projectId: event.target.value || undefined })}>
                      <option value="">Nenhum</option>
                      {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
                    </select>
                  </label>
                </div>
              </details>
              <div className="study-notes-save" role="status">
                {activeDraft?.status === 'saving' ? 'Salvando…' : activeDraft?.status === 'error' ? (
                  <span className="study-notes-error">
                    Falha ao salvar. <button onClick={() => update({})}>Tentar novamente</button>
                  </span>
                ) : <><Check size={15} /> Salvo neste dispositivo</>}
              </div>
            </>
          ) : (
            <div className="study-notes-empty">
              <span className="study-notes-empty-icon"><NotebookPen size={28} /></span>
              <h2>{notes.length ? 'Abra uma anotação' : 'Seu caderno começa aqui'}</h2>
              <p>{notes.length ? 'Escolha uma anotação da lista ou registre algo novo.' : 'Registre os pontos que quer lembrar ou as dúvidas que surgirem nos estudos.'}</p>
              <button className="button button-secondary" onClick={createNote}><BookOpen size={17} /> Criar anotação</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
