import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'
import type { CurriculumNode, Material } from '../../domain/types'

type Kind = CurriculumNode['kind']
export type EditableNode = Omit<CurriculumNode, 'id' | 'order'> & { id?: string }

export const kindNames: Record<Kind, string> = {
  phase: 'Fase',
  discipline: 'Disciplina',
  module: 'Módulo',
  topic: 'Tópico',
  activity: 'Atividade',
}

export const statusNames: Record<CurriculumNode['status'], string> = {
  pending: 'Pendente',
  'in-progress': 'Em andamento',
  completed: 'Concluído',
}

export interface EditTarget {
  kind: Kind
  node?: CurriculumNode
  parent?: CurriculumNode
}

interface PathDialogProps {
  title: string
  subtitle?: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}

function PathDialog({ title, subtitle, busy, onClose, children }: PathDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    return () => element.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      className="path-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="path-dialog-content">
        <div className="path-dialog-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="icon-button" aria-label="Fechar" onClick={onClose} disabled={busy}>
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

const toList = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

interface CurriculumEditorProps {
  target: EditTarget
  materials: Material[]
  onSave: (input: EditableNode) => Promise<void>
  onClose: () => void
}

export function CurriculumEditor({ target, materials, onSave, onClose }: CurriculumEditorProps) {
  const { kind, node, parent } = target
  const [materialIds, setMaterialIds] = useState(node?.materialIds ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hasStudyMetadata = kind === 'topic' || kind === 'activity'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const data = new FormData(event.currentTarget)
    const title = String(data.get('title') ?? '').trim()
    if (!title) {
      setError('Informe um título para salvar.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onSave({
        id: node?.id,
        parentId: parent?.id ?? node?.parentId ?? null,
        kind,
        title,
        description: String(data.get('description') ?? '').trim(),
        weeks: kind === 'phase' ? Number(data.get('weeks')) : node?.weeks,
        status: (data.get('status') ?? node?.status ?? 'pending') as CurriculumNode['status'],
        minutes: hasStudyMetadata ? Number(data.get('minutes')) : node?.minutes ?? 0,
        difficulty: (data.get('difficulty') ?? node?.difficulty ?? 'iniciante') as CurriculumNode['difficulty'],
        objectives: kind === 'topic' ? toList(String(data.get('objectives') ?? '')) : node?.objectives ?? [],
        prerequisites: kind === 'topic' ? toList(String(data.get('prerequisites') ?? '')) : node?.prerequisites ?? [],
        materialIds,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a alteração. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <PathDialog
      title={`${node ? 'Editar' : 'Adicionar'} ${kindNames[kind].toLocaleLowerCase('pt-BR')}`}
      subtitle={parent?.title}
      busy={busy}
      onClose={onClose}
    >
      <form className="path-form" onSubmit={submit}>
        <label className="field">
          Título
          <input name="title" defaultValue={node?.title} maxLength={180} required autoFocus />
        </label>
        <label className="field">
          Descrição
          <textarea name="description" defaultValue={node?.description} rows={3} />
        </label>
        {kind === 'phase' && (
          <label className="field">
            Semanas previstas
            <input type="number" name="weeks" min={1} step={1} defaultValue={node?.weeks ?? 4} required />
          </label>
        )}
        {hasStudyMetadata && (
          <div className="path-form-grid">
            <label className="field">
              Duração estimada (min)
              <input type="number" name="minutes" min={1} step={1} defaultValue={node?.minutes || 20} required />
            </label>
            <label className="field">
              Dificuldade
              <select name="difficulty" defaultValue={node?.difficulty ?? 'iniciante'}>
                <option value="iniciante">Iniciante</option>
                <option value="intermediário">Intermediário</option>
                <option value="avançado">Avançado</option>
              </select>
            </label>
          </div>
        )}
        {kind === 'topic' && (
          <>
            <div className="path-form-grid">
              <label className="field">
                Objetivos <small>Um por linha</small>
                <textarea name="objectives" defaultValue={node?.objectives.join('\n')} rows={3} />
              </label>
              <label className="field">
                Pré-requisitos <small>Um por linha</small>
                <textarea name="prerequisites" defaultValue={node?.prerequisites.join('\n')} rows={3} />
              </label>
            </div>
            <fieldset>
              <legend>Materiais recomendados</legend>
              {materials.length ? (
                <div className="path-material-list">
                  {materials.map((material) => (
                    <label key={material.id}>
                      <input
                        type="checkbox"
                        checked={materialIds.includes(material.id)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setMaterialIds((selection) => checked
                            ? [...selection, material.id]
                            : selection.filter((id) => id !== material.id))
                        }}
                      />
                      <span>{material.title}</span>
                    </label>
                  ))}
                </div>
              ) : <small>A biblioteca está vazia.</small>}
            </fieldset>
          </>
        )}
        {hasStudyMetadata && (
          <label className="field">
            Status
            <select name="status" defaultValue={node?.status ?? 'pending'}>
              {Object.entries(statusNames).map(([value, name]) => (
                <option value={value} key={value}>{kind === 'activity' && value === 'completed' ? 'Concluída' : name}</option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="path-error" role="alert">{error}</p>}
        <div className="path-dialog-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </PathDialog>
  )
}

interface DeleteConfirmationProps {
  node: CurriculumNode
  descendantCount: number
  onDelete: () => Promise<void>
  onClose: () => void
}

export function DeleteConfirmation({ node, descendantCount, onDelete, onClose }: DeleteConfirmationProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy) return
    setError('')
    setBusy(true)
    try {
      await onDelete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir. Tente novamente.')
      setBusy(false)
    }
  }

  return (
    <PathDialog title={`Excluir ${kindNames[node.kind].toLocaleLowerCase('pt-BR')}?`} busy={busy} onClose={onClose}>
      <div className="path-confirmation">
        <p>
          <strong>{node.title}</strong> será removido da sua trilha.
          {descendantCount > 0 && ` Itens vinculados que também serão removidos: ${descendantCount}.`}
        </p>
        <p>Suas anotações e seu histórico de sessões ficam disponíveis.</p>
        {error && <p className="path-error" role="alert">{error}</p>}
        <div className="path-dialog-actions">
          <button type="button" className="button button-secondary" onClick={onClose} disabled={busy} autoFocus>Cancelar</button>
          <button type="button" className="button path-danger-button" onClick={() => void confirm()} disabled={busy}>
            {busy ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </PathDialog>
  )
}
