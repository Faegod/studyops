import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Book, BookOpen, FileText, FolderOpen, GraduationCap, LibraryBig, Pencil, Plus, Search, Trash2, Video } from 'lucide-react'
import { db } from '../../db/database'
import type { CurriculumNode, Material } from '../../domain/types'
import { Modal, PageHeading } from '../../ui/components'
import { normalizeSearch, parseWebUrl } from './resourceUtils'
import './resources.css'

type LibraryPageProps = {
  materials: Material[]
  nodes: CurriculumNode[]
  materialId?: string
  onNotify: (message: string) => void
}

const materialTypes: Material['type'][] = ['curso', 'documentação', 'artigo', 'livro', 'vídeo']
const difficulties: Material['difficulty'][] = ['iniciante', 'intermediário', 'avançado']
const typeIcons = { curso: GraduationCap, documentação: FileText, artigo: FileText, livro: Book, vídeo: Video }

function newMaterial(): Material {
  return { id: crypto.randomUUID(), title: '', url: '', source: '', subject: '', language: 'Português', type: 'curso', difficulty: 'iniciante' }
}

export default function LibraryPage({ materials, nodes, materialId, onNotify }: LibraryPageProps) {
  const [query, setQuery] = useState('')
  const [subject, setSubject] = useState('')
  const [language, setLanguage] = useState('')
  const [type, setType] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [draft, setDraft] = useState<Material>()
  const [pendingRemoval, setPendingRemoval] = useState<Material>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const subjects = useMemo(() => [...new Set(materials.map((material) => material.subject))].filter(Boolean).sort(), [materials])
  const languages = useMemo(() => [...new Set(materials.map((material) => material.language))].filter(Boolean).sort(), [materials])
  const normalized = normalizeSearch(query)
  const visible = materials.filter((material) =>
    (!subject || subject === material.subject) && (!language || language === material.language) &&
    (!type || type === material.type) && (!difficulty || difficulty === material.difficulty) &&
    normalizeSearch([material.title, material.source, material.url, material.subject].join(' ')).includes(normalized)
  ).sort((first, second) => {
    if (first.id === materialId) return -1
    if (second.id === materialId) return 1
    return first.title.localeCompare(second.title, 'pt-BR')
  })

  function openEditor(material: Material) {
    setError('')
    setDraft(material)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || saving) return
    const url = parseWebUrl(draft.url)
    if (!url || !draft.title.trim() || !draft.subject.trim() || !draft.language.trim()) {
      setError('Informe título, assunto, idioma e uma URL HTTP ou HTTPS válida.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await db.materials.put({
        ...draft,
        title: draft.title.trim(),
        url: url.href,
        source: draft.source.trim() || url.hostname,
        subject: draft.subject.trim(),
        language: draft.language.trim(),
      })
      setDraft(undefined)
      onNotify('Material salvo.')
    } catch {
      setError('Não foi possível salvar o material. Tente novamente.')
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
      await db.transaction('rw', db.materials, db.nodes, db.sessions, async () => {
        await db.nodes.filter((node) => node.materialIds.includes(id)).modify((node) => {
          node.materialIds = node.materialIds.filter((materialId) => materialId !== id)
        })
        await db.sessions.filter((session) => session.materialId === id).modify({ materialId: undefined })
        await db.materials.delete(id)
      })
      setPendingRemoval(undefined)
      onNotify('Material excluído.')
    } catch {
      setError('Não foi possível excluir o material. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function resetFilters() {
    setQuery('')
    setSubject('')
    setLanguage('')
    setType('')
    setDifficulty('')
  }

  return (
    <section className="study-resource">
      <PageHeading title="Biblioteca" description="Encontre e organize os materiais da sua formação."
        action={<button className="button button-primary" onClick={() => openEditor(newMaterial())}><Plus size={18} /> Novo material</button>} />

      <div className="card study-resource-filters study-library-filters">
        <label className="field study-library-query">Pesquisa
          <span className="study-resource-search"><Search size={17} /><input type="search" value={query} placeholder="Título, provedor ou assunto" onChange={(event) => setQuery(event.target.value)} /></span>
        </label>
        <label className="field">Assunto<select value={subject} onChange={(event) => setSubject(event.target.value)}>
          <option value="">Todos</option>
          {subjects.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="field">Idioma<select value={language} onChange={(event) => setLanguage(event.target.value)}>
          <option value="">Todos</option>
          {languages.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="field">Tipo<select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Todos</option>
          {materialTypes.map((item) => <option key={item}>{item}</option>)}
        </select></label>
        <label className="field">Dificuldade<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
          <option value="">Todas</option>
          {difficulties.map((item) => <option key={item}>{item}</option>)}
        </select></label>
      </div>

      {visible.length ? (
        <div className="study-resource-grid">
          {visible.map((material) => {
            const Icon = typeIcons[material.type] ?? BookOpen
            const topics = nodes.filter((node) => node.kind === 'topic' && node.materialIds.includes(material.id)).length
            const url = parseWebUrl(material.url)
            return (
              <article key={material.id} className={'card study-resource-card' + (material.id === materialId ? ' study-resource-selected' : '')}>
                <div className="study-resource-card-top">
                  <span className="empty-icon"><Icon size={21} /></span>
                  <div className="study-resource-actions">
                    <button className="icon-button" onClick={() => openEditor(material)} aria-label={'Editar ' + material.title} title="Editar material"><Pencil size={16} /></button>
                    <button className="icon-button" onClick={() => { setPendingRemoval(material); setError('') }} aria-label={'Excluir ' + material.title} title="Excluir material"><Trash2 size={16} /></button>
                  </div>
                </div>
                <div className="study-resource-card-body">
                  <h2>{material.title}</h2>
                  <p>{material.source} · {material.subject}</p>
                </div>
                <div className="study-resource-tags">
                  <span className="badge">{material.type}</span>
                  <span className="badge">{material.language}</span>
                  <span className="badge">{material.difficulty}</span>
                </div>
                <div className="study-resource-card-footer">
                  {url ? <a className="button button-secondary" href={url.href} target="_blank" rel="noopener noreferrer"><BookOpen size={16} /> Abrir material</a>
                    : <span className="error-text">URL inválida</span>}
                  {topics > 0 && <span className="muted">{topics} {topics === 1 ? 'tópico' : 'tópicos'}</span>}
                </div>
              </article>
            )
          })}
        </div>
      ) : <div className="empty-state">
        <span className="empty-icon"><LibraryBig size={22} /></span>
        <strong>{materials.length ? 'Nenhum material encontrado' : 'Sua biblioteca está vazia'}</strong>
        <p>{materials.length ? 'Ajuste os filtros para pesquisar outros materiais.' : 'Adicione links de estudo para encontrar tudo em um só lugar.'}</p>
        {materials.length
          ? <button className="button button-secondary" onClick={resetFilters}>Limpar filtros</button>
          : <button className="button button-secondary" onClick={() => openEditor(newMaterial())}><FolderOpen size={16} /> Adicionar material</button>}
      </div>}

      {draft && (
        <Modal title={materials.some((material) => material.id === draft.id) ? 'Editar material' : 'Novo material'} onClose={() => { if (!saving) setDraft(undefined) }}>
          <form className="study-resource-form" onSubmit={(event) => void save(event)}>
            <label className="field">Título<input required autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label className="field">URL<input type="url" required value={draft.url} placeholder="https://…" onChange={(event) => setDraft({ ...draft, url: event.target.value })} /></label>
            <div className="study-resource-form-row">
              <label className="field">Provedor<input value={draft.source} placeholder="Opcional" onChange={(event) => setDraft({ ...draft, source: event.target.value })} /></label>
              <label className="field">Assunto<input required list="study-library-subjects" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} /></label>
              <datalist id="study-library-subjects">{subjects.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            <div className="study-resource-form-row">
              <label className="field">Idioma<input required list="study-library-languages" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} /></label>
              <label className="field">Tipo<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as Material['type'] })}>
                {materialTypes.map((item) => <option key={item}>{item}</option>)}
              </select></label>
              <label className="field">Dificuldade<select value={draft.difficulty} onChange={(event) => setDraft({ ...draft, difficulty: event.target.value as Material['difficulty'] })}>
                {difficulties.map((item) => <option key={item}>{item}</option>)}
              </select></label>
              <datalist id="study-library-languages">{languages.map((item) => <option key={item} value={item} />)}</datalist>
            </div>
            {error && <div className="error-text" role="alert">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={saving} onClick={() => setDraft(undefined)}>Cancelar</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar material'}</button>
            </div>
          </form>
        </Modal>
      )}
      {pendingRemoval && (
        <Modal title="Excluir material?" onClose={() => { if (!saving) setPendingRemoval(undefined) }}>
          <p>O material “{pendingRemoval.title}” será removido da biblioteca e dos tópicos vinculados.</p>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="modal-actions">
            <button className="button button-secondary" disabled={saving} onClick={() => setPendingRemoval(undefined)}>Cancelar</button>
            <button className="button button-danger" disabled={saving} onClick={() => void remove()}>{saving ? 'Excluindo…' : 'Excluir material'}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
