import { useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardList, FolderKanban, GitBranch, Pencil, Plus, Trash2, X } from 'lucide-react'
import { db } from '../../db/database'
import type { CurriculumNode, Project } from '../../domain/types'
import { Modal, PageHeading } from '../../ui/components'
import { NotesMarkdown } from '../notes/NotesPage'
import { parseWebUrl, splitEntries } from './resourceUtils'
import './resources.css'

type ProjectsPageProps = {
  projects: Project[]
  nodes: CurriculumNode[]
  projectId?: string
  onNotify: (message: string) => void
}

const statusNames: Record<Project['status'], string> = {
  planejado: 'Planejado',
  'em-andamento': 'Em andamento',
  concluído: 'Concluído',
}

const statuses = Object.keys(statusNames) as Project['status'][]

function newProject(): Project {
  return {
    id: crypto.randomUUID(), title: '', objective: '', skills: [], topicIds: [],
    tasks: [], notes: '', status: 'planejado', updatedAt: Date.now(),
  }
}

function parseRepository(value: string): URL | undefined {
  const url = parseWebUrl(value)
  if (url?.hostname === 'github.com' && url.pathname.split('/').filter(Boolean).length >= 2) return url
}

export default function ProjectsPage({ projects, nodes, projectId, onNotify }: ProjectsPageProps) {
  const [status, setStatus] = useState<Project['status'] | ''>('')
  const [draft, setDraft] = useState<Project>()
  const [skills, setSkills] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState<Project>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingTasks, setPendingTasks] = useState<Set<string>>(() => new Set())
  const topics = nodes.filter((node) => node.kind === 'topic')

  const visibleProjects = projects.filter((project) => !status || project.status === status).sort((first, second) => {
    if (first.id === projectId) return -1
    if (second.id === projectId) return 1
    return second.updatedAt - first.updatedAt
  })

  function openEditor(project: Project) {
    setError('')
    setSkills(project.skills.join(', '))
    setDraft(project)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || saving) return
    const title = draft.title.trim()
    const objective = draft.objective.trim()
    const repository = draft.repository?.trim() ? parseRepository(draft.repository) : undefined
    const tasks = draft.tasks.map((task) => ({ ...task, title: task.title.trim() }))
    if (!title || !objective || tasks.some((task) => !task.title)) {
      setError('Preencha o título, o objetivo e todas as tarefas adicionadas.')
      return
    }
    if (draft.repository?.trim() && !repository) {
      setError('Informe a URL de um repositório no GitHub.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await db.projects.put({
        ...draft, title, objective, tasks, skills: splitEntries(skills),
        repository: repository?.href, updatedAt: Date.now(),
      })
      setDraft(undefined)
      onNotify('Projeto salvo.')
    } catch {
      setError('Não foi possível salvar o projeto. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!pendingRemoval || saving) return
    const id = pendingRemoval.id
    setSaving(true)
    setError('')
    try {
      await db.transaction('rw', db.projects, db.notes, async () => {
        await db.notes.filter((note) => note.projectId === id).modify({ projectId: undefined })
        await db.projects.delete(id)
      })
      setPendingRemoval(undefined)
      onNotify('Projeto excluído.')
    } catch {
      setError('Não foi possível excluir o projeto. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleTask(id: string, taskId: string, done: boolean) {
    setPendingTasks((items) => new Set(items).add(taskId))
    try {
      await db.transaction('rw', db.projects, async () => {
        const current = await db.projects.get(id)
        if (!current) return
        const tasks = current.tasks.map((task) => task.id === taskId ? { ...task, done } : task)
        await db.projects.update(id, { tasks, updatedAt: Date.now() })
      })
    } catch {
      onNotify('Não foi possível atualizar a tarefa. Tente novamente.')
    } finally {
      setPendingTasks((items) => {
        const remaining = new Set(items)
        remaining.delete(taskId)
        return remaining
      })
    }
  }

  return (
    <section className="study-resource">
      <PageHeading title="Projetos" description="Aplique o que está estudando e acompanhe seu portfólio."
        action={<button className="button button-primary" onClick={() => openEditor(newProject())}><Plus size={18} /> Novo projeto</button>} />

      {projects.length > 0 && <div className="study-resource-tabs" aria-label="Filtrar projetos por status">
        <button aria-pressed={!status} onClick={() => setStatus('')}>Todos</button>
        {statuses.map((item) => <button key={item} aria-pressed={status === item} onClick={() => setStatus(item)}>{statusNames[item]}</button>)}
      </div>}

      {visibleProjects.length ? (
        <div className="study-resource-grid">
          {visibleProjects.map((project) => {
            const completed = project.tasks.filter((task) => task.done).length
            const topicNames = topics.filter((topic) => project.topicIds.includes(topic.id)).map((topic) => topic.title)
            const url = project.repository ? parseRepository(project.repository) : undefined
            return (
              <article className={'card study-resource-card' + (project.id === projectId ? ' study-resource-selected' : '')} key={project.id}>
                <div className="study-resource-card-top">
                  <span className="empty-icon"><FolderKanban size={21} /></span>
                  <div className="study-resource-actions">
                    <button className="icon-button" onClick={() => openEditor(project)} aria-label={'Editar ' + project.title} title="Editar projeto"><Pencil size={16} /></button>
                    <button className="icon-button" onClick={() => { setPendingRemoval(project); setError('') }} aria-label={'Excluir ' + project.title} title="Excluir projeto"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="study-resource-card-body">
                  <span className="badge">{statusNames[project.status]}</span>
                  <h2>{project.title}</h2>
                  <p className="study-resource-preserve-lines">{project.objective}</p>
                </div>
                {project.skills.length > 0 && <div className="study-resource-tags" aria-label="Habilidades relacionadas">
                  {project.skills.map((skill) => <span className="badge" key={skill}>{skill}</span>)}
                </div>}
                {topicNames.length > 0 && <p className="muted study-resource-linked">Tópicos · {topicNames.join(', ')}</p>}
                {project.tasks.length > 0 && (
                  <div className="study-project-checklist">
                    <div><strong><ClipboardList size={16} /> Checklist</strong><span>{completed}/{project.tasks.length}</span></div>
                    <progress max={project.tasks.length} value={completed} aria-label="Progresso do checklist" />
                    <ul>
                      {project.tasks.map((task) => <li key={task.id}>
                        <label className={task.done ? 'study-project-task-done' : ''}>
                          <input type="checkbox" checked={task.done} disabled={pendingTasks.has(task.id)}
                            onChange={(event) => void toggleTask(project.id, task.id, event.target.checked)} />
                          {task.title}
                        </label>
                      </li>)}
                    </ul>
                  </div>
                )}
                {project.notes.trim() && <details className="study-resource-details">
                  <summary>Anotações</summary>
                  <NotesMarkdown content={project.notes} />
                </details>}
                {url && <div className="study-resource-card-footer"><a className="button button-secondary" href={url.href} target="_blank" rel="noopener noreferrer"><GitBranch size={17} /> Abrir repositório</a></div>}
              </article>
            )
          })}
        </div>
      ) : <div className="empty-state">
        <span className="empty-icon"><FolderKanban size={22} /></span>
        <strong>{projects.length ? 'Sem projetos neste status' : 'Comece um projeto prático'}</strong>
        <p>{projects.length ? 'Veja todos os projetos ou adicione um novo.' : 'Defina um objetivo, relacione habilidades e divida o trabalho em tarefas.'}</p>
        <button className="button button-secondary" onClick={() => openEditor(newProject())}><Plus size={16} /> Criar projeto</button>
      </div>}

      {draft && (
        <Modal title={projects.some((project) => project.id === draft.id) ? 'Editar projeto' : 'Novo projeto'} onClose={() => { if (!saving) setDraft(undefined) }}>
          <form onSubmit={(event) => void save(event)}>
            <fieldset className="study-resource-form" disabled={saving}>
              <label className="field">Título<input required autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
              <label className="field">Objetivo<textarea required rows={2} value={draft.objective} onChange={(event) => setDraft({ ...draft, objective: event.target.value })} /></label>
              <div className="study-resource-form-row">
                <label className="field">Habilidades<input placeholder="Separadas por vírgula" value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
                <label className="field">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Project['status'] })}>
                  {statuses.map((item) => <option key={item} value={item}>{statusNames[item]}</option>)}
                </select></label>
              </div>
              {topics.length > 0 && <details className="study-resource-details">
                <summary>Tópicos relacionados{draft.topicIds.length > 0 && ' (' + draft.topicIds.length + ')'}</summary>
                <div className="study-project-topic-picker">
                  {topics.map((topic) => <label key={topic.id}>
                    <input type="checkbox" checked={draft.topicIds.includes(topic.id)} onChange={(event) => setDraft({
                      ...draft,
                      topicIds: event.target.checked ? [...draft.topicIds, topic.id] : draft.topicIds.filter((id) => id !== topic.id),
                    })} /> {topic.title}
                  </label>)}
                </div>
              </details>}
              <div className="study-project-checklist study-project-checklist-editor">
                <strong><ClipboardList size={17} /> Checklist</strong>
                {draft.tasks.map((task, index) => (
                  <div className="study-project-edit-task" key={task.id}>
                    <input type="checkbox" aria-label={'Tarefa concluída ' + (index + 1)} checked={task.done} onChange={(event) => setDraft({
                      ...draft, tasks: draft.tasks.map((item) => item.id === task.id ? { ...item, done: event.target.checked } : item),
                    })} />
                    <input className="text-input" aria-label={'Tarefa ' + (index + 1)} placeholder="Descreva a tarefa" required value={task.title} onChange={(event) => setDraft({
                      ...draft, tasks: draft.tasks.map((item) => item.id === task.id ? { ...item, title: event.target.value } : item),
                    })} />
                    <button type="button" className="icon-button" aria-label={'Remover tarefa ' + (index + 1)} onClick={() => setDraft({
                      ...draft, tasks: draft.tasks.filter((item) => item.id !== task.id),
                    })}><X size={17} /></button>
                  </div>
                ))}
                <button type="button" className="button button-secondary" onClick={() => setDraft({
                  ...draft, tasks: [...draft.tasks, { id: crypto.randomUUID(), title: '', done: false }],
                })}><Plus size={16} /> Adicionar tarefa</button>
              </div>
              <label className="field">Anotações<textarea rows={3} placeholder="Markdown opcional" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
              <label className="field">Repositório GitHub<input type="url" placeholder="Opcional" value={draft.repository ?? ''} onChange={(event) => setDraft({ ...draft, repository: event.target.value })} /></label>
            </fieldset>
            {error && <div className="error-text" role="alert">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={saving} onClick={() => setDraft(undefined)}>Cancelar</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar projeto'}</button>
            </div>
          </form>
        </Modal>
      )}
      {pendingRemoval && (
        <Modal title="Excluir projeto?" onClose={() => { if (!saving) setPendingRemoval(undefined) }}>
          <p>O projeto “{pendingRemoval.title}” e suas tarefas serão removidos.</p>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="modal-actions">
            <button className="button button-secondary" disabled={saving} onClick={() => setPendingRemoval(undefined)}>Cancelar</button>
            <button className="button button-danger" disabled={saving} onClick={() => void remove()}>{saving ? 'Excluindo…' : 'Excluir projeto'}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
