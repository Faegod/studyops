import { useMemo, useRef, useState } from 'react'
import {
  BookMarked, BookOpen, Check, ChevronDown, ChevronRight, Circle, CircleCheck, CircleDot,
  Ellipsis, Files, GraduationCap, Layers3, LibraryBig, ListChecks, NotebookPen, Pencil, Play, Plus, Trash2,
} from 'lucide-react'
import type { CurriculumNode, Material, Note } from '../../domain/types'
import { getTopicProgress } from '../../domain/study'
import { deleteNode, moveNode, saveNode } from '../../db/study'
import { CurriculumEditor, DeleteConfirmation, kindNames, statusNames, type EditableNode, type EditTarget } from './CurriculumEditor'
import './CurriculumPage.css'

type Kind = CurriculumNode['kind']

interface CurriculumPageProps {
  nodes: CurriculumNode[]
  materials: Material[]
  notes?: Note[]
  onStudy: (nodeId: string) => void
  onNotes: (topicId: string) => void
  selectedNodeId?: string
  onNotify: (message: string) => void
}

const childKinds = {
  phase: 'discipline',
  discipline: 'module',
  module: 'topic',
  topic: 'activity',
} as const satisfies Partial<Record<Kind, Kind>>

const addLabels: Record<Kind, string> = {
  phase: 'Nova fase',
  discipline: 'Adicionar disciplina',
  module: 'Adicionar módulo',
  topic: 'Adicionar tópico',
  activity: 'Adicionar atividade',
}

const emptyLabels = {
  discipline: 'Esta fase ainda não tem disciplinas.',
  module: 'Esta disciplina ainda não tem módulos.',
  topic: 'Este módulo ainda não tem tópicos.',
}

const treeIcons = { discipline: BookOpen, module: Layers3, topic: BookMarked }

const plural = (value: number, singular: string, pluralLabel: string) => `${value} ${value === 1 ? singular : pluralLabel}`

function statusName(node: CurriculumNode) {
  if (node.kind === 'activity' && node.status !== 'in-progress') {
    return node.status === 'completed' ? 'Concluída' : 'Pendente'
  }
  return statusNames[node.status]
}

function Status({ node }: { node: CurriculumNode }) {
  const Icon = node.status === 'completed' ? CircleCheck : node.status === 'in-progress' ? CircleDot : Circle
  return (
    <span className={`path-status path-status-${node.status}`}>
      <Icon size={13} aria-hidden="true" /> <span>{statusName(node)}</span>
    </span>
  )
}

interface NodeActionsProps {
  node: CurriculumNode
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onEdit: () => void
  onMove: (direction: -1 | 1) => void
  onDelete: () => void
  onAdd?: () => void
}

function NodeActions({ node, canMoveUp, canMoveDown, busy, onEdit, onMove, onDelete, onAdd }: NodeActionsProps) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const childKind = node.kind !== 'activity' ? childKinds[node.kind] : null

  function invoke(action: () => void) {
    setOpen(false)
    trigger.current?.focus()
    action()
  }

  return (
    <div
      className="path-menu"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false)
          trigger.current?.focus()
        }
      }}
    >
      <button type="button" ref={trigger} className="path-menu-trigger" title="Opções" aria-label={`Opções de ${node.title}`}
        aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <Ellipsis size={19} aria-hidden="true" />
      </button>
      {open && (
        <div className="path-menu-panel">
          <button type="button" onClick={() => invoke(onEdit)} disabled={busy}><Pencil size={15} aria-hidden="true" /> Editar</button>
          {onAdd && childKind && (
            <button type="button" onClick={() => invoke(onAdd)} disabled={busy}>
              <Plus size={15} aria-hidden="true" /> {addLabels[childKind]}
            </button>
          )}
          <button type="button" onClick={() => invoke(() => onMove(-1))} disabled={busy || !canMoveUp}>Mover para cima</button>
          <button type="button" onClick={() => invoke(() => onMove(1))} disabled={busy || !canMoveDown}>Mover para baixo</button>
          <button type="button" className="path-danger" onClick={() => invoke(onDelete)} disabled={busy}><Trash2 size={15} aria-hidden="true" /> Excluir</button>
        </div>
      )}
    </div>
  )
}

function referenceUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

function TopicReferences({ topic, materials }: { topic: CurriculumNode; materials: Map<string, Material> }) {
  const references = topic.materialIds.flatMap((id) => {
    const material = materials.get(id)
    const href = material && referenceUrl(material.url)
    return material && href ? [{ material, href }] : []
  })
  return (
    <section>
      <h3>Materiais recomendados</h3>
      {references.length > 0 ? (
        <div className="path-material-links">
          {references.map(({ material, href }) => (
            <a key={material.id} href={href} target="_blank" rel="noopener noreferrer">
              <LibraryBig size={15} aria-hidden="true" /> <span>{material.title}</span>
            </a>
          ))}
        </div>
      ) : <small className="path-note-count">Nenhum material vinculado.</small>}
    </section>
  )
}

function TopicList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <section>
      <h3>{title}</h3>
      {items.length > 0
        ? <ul>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>
        : <small className="path-note-count">{empty}</small>}
    </section>
  )
}

export default function CurriculumPage({ nodes, materials, notes, onStudy, onNotes, selectedNodeId, onNotify }: CurriculumPageProps) {
  const [phaseSelection, setPhaseSelection] = useState<{ phaseId: string; routeId?: string }>()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [editTarget, setEditTarget] = useState<EditTarget>()
  const [deleteTarget, setDeleteTarget] = useState<CurriculumNode>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { childrenByParent, allById } = useMemo(() => {
    const byParent = new Map<string | null, CurriculumNode[]>()
    const byId = new Map<string, CurriculumNode>()
    for (const node of nodes) {
      const siblings = byParent.get(node.parentId) ?? []
      siblings.push(node)
      byParent.set(node.parentId, siblings)
      byId.set(node.id, node)
    }
    for (const group of byParent.values()) group.sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    return { childrenByParent: byParent, allById: byId }
  }, [nodes])

  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials])
  const phases = childrenByParent.get(null) ?? []
  const routePath = new Set<string>()
  let routeNode = selectedNodeId ? allById.get(selectedNodeId) : undefined
  let routePhaseId: string | undefined
  while (routeNode && !routePath.has(routeNode.id)) {
    routePath.add(routeNode.id)
    if (routeNode.kind === 'phase') routePhaseId = routeNode.id
    routeNode = routeNode.parentId ? allById.get(routeNode.parentId) : undefined
  }

  const preferredPhase = phaseSelection?.routeId === selectedNodeId ? phaseSelection?.phaseId : routePhaseId
  const currentPhase = phases.find((phase) => phase.id === preferredPhase) ?? phases[0]
  const disciplines = currentPhase ? childrenByParent.get(currentPhase.id) ?? [] : []
  const firstDiscipline = disciplines[0]?.id
  const firstModule = firstDiscipline ? childrenByParent.get(firstDiscipline)?.[0]?.id : undefined
  const { total: topicCount, completed: completedTopics } = getTopicProgress(nodes)
  const progress = topicCount ? Math.round(completedTopics / topicCount * 100) : 0

  function getDescendants(id: string) {
    const descendants: CurriculumNode[] = []
    const traversed = new Set([id])
    const pending = [...(childrenByParent.get(id) ?? [])]
    while (pending.length) {
      const candidate = pending.pop()!
      if (traversed.has(candidate.id)) continue
      traversed.add(candidate.id)
      descendants.push(candidate)
      pending.push(...(childrenByParent.get(candidate.id) ?? []))
    }
    return descendants
  }

  function addChild(parent: CurriculumNode) {
    if (parent.kind === 'activity') return
    setExpanded((previous) => ({ ...previous, [parent.id]: true }))
    setEditTarget({ kind: childKinds[parent.kind], parent })
  }

  async function persist(input: EditableNode) {
    const result = await saveNode(input)
    if (result.kind === 'phase') setPhaseSelection({ phaseId: result.id, routeId: selectedNodeId })
    setEditTarget(undefined)
    onNotify(input.id ? 'Alterações salvas.' : 'Novo item salvo na trilha.')
  }

  async function remove() {
    if (!deleteTarget) return
    await deleteNode(deleteTarget.id)
    setDeleteTarget(undefined)
    onNotify('Item removido da trilha.')
  }

  async function mutate(action: () => Promise<unknown>, successMessage: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
      onNotify(successMessage)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a alteração. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }

  function markStatus(node: CurriculumNode) {
    const status = node.status === 'completed' ? 'pending' : 'completed'
    void mutate(() => saveNode({ ...node, status }), 'Status atualizado.')
  }

  function renderOptions(node: CurriculumNode, index: number, length: number) {
    return (
      <NodeActions
        node={node}
        canMoveUp={index > 0}
        canMoveDown={index + 1 < length}
        busy={busy}
        onEdit={() => setEditTarget({ kind: node.kind, node, parent: node.parentId ? allById.get(node.parentId) : undefined })}
        onMove={(direction) => void mutate(() => moveNode(node.id, direction), 'Ordem atualizada.')}
        onDelete={() => setDeleteTarget(node)}
        onAdd={node.kind === 'discipline' || node.kind === 'module' ? () => addChild(node) : undefined}
      />
    )
  }

  function renderActivity(activity: CurriculumNode, index: number, group: CurriculumNode[]) {
    return (
      <div className="path-activity" key={activity.id}>
        <div className="path-activity-top">
          <div className="path-activity-title"><ListChecks size={16} aria-hidden="true" /> {activity.title}</div>
          <div>
            <Status node={activity} />
            {renderOptions(activity, index, group.length)}
          </div>
        </div>
        {activity.description && <p>{activity.description}</p>}
        <div className="path-time">{activity.minutes} min · {activity.difficulty}</div>
        <div className="path-detail-actions">
          <button type="button" className="button button-secondary" onClick={() => onStudy(activity.id)}>
            <Play size={14} aria-hidden="true" /> Estudar atividade
          </button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => markStatus(activity)}>
            <Check size={14} aria-hidden="true" /> {activity.status === 'completed' ? 'Reabrir atividade' : 'Concluir atividade'}
          </button>
        </div>
      </div>
    )
  }

  function renderTopicDetail(topic: CurriculumNode, activities: CurriculumNode[]) {
    const noteCount = notes?.filter((note) => note.topicId === topic.id).length
    return (
      <div className="path-detail" id={`path-${topic.id}`}>
        {topic.description && <p>{topic.description}</p>}
        <div className="path-detail-grid">
          <TopicList title="Objetivos" items={topic.objectives} empty="Nenhum objetivo cadastrado." />
          <TopicList title="Pré-requisitos" items={topic.prerequisites} empty="Nenhum pré-requisito cadastrado." />
        </div>
        <TopicReferences topic={topic} materials={materialById} />
        <section className="path-activities">
          <div className="path-activities-heading">
            <h3>Atividades práticas</h3>
            <button type="button" className="button button-secondary" onClick={() => addChild(topic)}>
              <Plus size={15} aria-hidden="true" /> Adicionar atividade
            </button>
          </div>
          {activities.length > 0 ? activities.map(renderActivity) : <small className="path-note-count">Nenhuma atividade cadastrada.</small>}
        </section>
        <div className="path-detail-actions">
          <button type="button" className="button button-primary" onClick={() => onStudy(topic.id)}>
            <Play size={15} aria-hidden="true" /> Estudar tópico
          </button>
          <button type="button" className="button button-secondary" onClick={() => onNotes(topic.id)}>
            <NotebookPen size={15} aria-hidden="true" /> Anotações{noteCount ? ` (${noteCount})` : ''}
          </button>
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => markStatus(topic)}>
            <Check size={15} aria-hidden="true" /> {topic.status === 'completed' ? 'Reabrir tópico' : 'Concluir tópico'}
          </button>
        </div>
      </div>
    )
  }

  function renderTreeNode(node: CurriculumNode, index: number, group: CurriculumNode[]) {
    if (node.kind === 'phase' || node.kind === 'activity') return null
    const childKind = childKinds[node.kind]
    const children = childrenByParent.get(node.id) ?? []
    const defaultOpen = routePath.has(node.id) || firstDiscipline === node.id || firstModule === node.id
    const open = expanded[node.id] ?? defaultOpen
    const Chevron = open ? ChevronDown : ChevronRight
    const Icon = treeIcons[node.kind]

    return (
      <article className={`path-node path-${node.kind}`} key={node.id}>
        <div className="path-node-row">
          <button
            type="button"
            className="path-node-button"
            aria-expanded={open}
            aria-controls={open ? `path-${node.id}` : undefined}
            onClick={() => setExpanded((previous) => ({ ...previous, [node.id]: !open }))}
          >
            <Chevron size={16} aria-hidden="true" />
            <Icon size={18} aria-hidden="true" />
            <span>
              <strong>{node.title}</strong>
              <small>{node.kind === 'topic' ? `${node.minutes} min · ${node.difficulty}` : kindNames[node.kind]}</small>
            </span>
          </button>
          {node.kind === 'topic' && <Status node={node} />}
          {renderOptions(node, index, group.length)}
        </div>
        {open && (node.kind === 'topic' ? renderTopicDetail(node, children) : (
          <div id={`path-${node.id}`} className="path-children">
            {node.description && <div className="path-node-description">{node.description}</div>}
            {children.length > 0 ? children.map(renderTreeNode) : (
              <div className="path-empty">
                <p>{node.kind === 'discipline' ? emptyLabels.module : emptyLabels.topic}</p>
                <button type="button" className="button button-secondary" onClick={() => addChild(node)}>
                  <Plus size={15} aria-hidden="true" /> {addLabels[childKind]}
                </button>
              </div>
            )}
          </div>
        ))}
      </article>
    )
  }

  return (
    <div className="path-page">
      <div className="page-heading path-page-header">
        <div>
          <h1>Minha Trilha</h1>
          <p>Organize e acompanhe sua formação em tecnologia.</p>
        </div>
        <button type="button" className="button button-primary" onClick={() => setEditTarget({ kind: 'phase' })}>
          <Plus size={17} aria-hidden="true" /> Nova fase
        </button>
      </div>

      <section className="path-overview" aria-label="Progresso da formação">
        <div className="path-overview-title">
          <span><GraduationCap size={24} aria-hidden="true" /></span>
          <div>
            <h2>Formação em TI</h2>
            <p>{plural(phases.length, 'fase', 'fases')} · {plural(topicCount, 'tópico', 'tópicos')}</p>
          </div>
        </div>
        <div className="path-overview-progress">
          <div className="path-progress-label"><span>{completedTopics} de {topicCount} concluídos</span><strong>{progress}%</strong></div>
          <div className="path-progress-track" role="progressbar" aria-label="Tópicos concluídos" aria-valuenow={progress}>
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </section>

      {error && <p className="path-error" role="alert">{error}</p>}
      {currentPhase ? (
        <div className="path-layout">
          <nav className="path-rail" aria-label="Fases da formação">
            <h2>Fases da formação</h2>
            {phases.map((phase, index) => (
              <button
                type="button"
                className="path-phase-button"
                aria-current={currentPhase.id === phase.id ? 'true' : undefined}
                key={phase.id}
                onClick={() => setPhaseSelection({ phaseId: phase.id, routeId: selectedNodeId })}
              >
                <span className="path-phase-number">{index + 1}</span>
                <span>
                  <strong>{phase.title}</strong>
                  {phase.weeks ? <small>{plural(phase.weeks, 'semana', 'semanas')}</small> : null}
                </span>
              </button>
            ))}
          </nav>
          <section className="path-phase" aria-labelledby="path-current-phase">
            <div className="path-phase-header">
              <div className="path-phase-title">
                <span className="path-phase-icon"><Files size={21} aria-hidden="true" /></span>
                <div>
                  <h2 id="path-current-phase">{currentPhase.title}</h2>
                  <p>{plural(disciplines.length, 'disciplina', 'disciplinas')}{currentPhase.weeks ? ` · ${plural(currentPhase.weeks, 'semana', 'semanas')}` : ''}</p>
                </div>
              </div>
              {renderOptions(currentPhase, phases.indexOf(currentPhase), phases.length)}
            </div>
            {currentPhase.description && <p className="path-phase-description">{currentPhase.description}</p>}
            {disciplines.length > 0
              ? <div className="path-tree">{disciplines.map(renderTreeNode)}</div>
              : <div className="path-empty"><p>{emptyLabels.discipline}</p></div>}
            <div className="path-phase-tools">
              <button type="button" className="button button-secondary" onClick={() => addChild(currentPhase)}>
                <Plus size={16} aria-hidden="true" /> Adicionar disciplina
              </button>
            </div>
          </section>
        </div>
      ) : (
        <section className="card empty-state">
          <BookOpen size={25} aria-hidden="true" />
          <h2>Sua trilha está vazia</h2>
          <p>Crie uma fase para reunir disciplinas, módulos e tópicos.</p>
          <button type="button" className="button button-primary" onClick={() => setEditTarget({ kind: 'phase' })}>Criar primeira fase</button>
        </section>
      )}

      {editTarget && <CurriculumEditor target={editTarget} materials={materials} onSave={persist} onClose={() => setEditTarget(undefined)} />}
      {deleteTarget && (
        <DeleteConfirmation
          node={deleteTarget}
          descendantCount={getDescendants(deleteTarget.id).length}
          onDelete={remove}
          onClose={() => setDeleteTarget(undefined)}
        />
      )}
    </div>
  )
}
