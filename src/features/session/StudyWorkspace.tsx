import { lazy, Suspense, useEffect, useState } from 'react'
import {
  BookOpen, Check, CirclePause, Clock3, ExternalLink, FileText, Layers3,
  NotebookPen, PhoneIncoming, Play, RotateCcw, Target,
} from 'lucide-react'
import type { CurriculumNode, Material, Note, Session } from '../../domain/types'
import { getElapsedMs, MINUTE_MS, type Recommendation } from '../../domain/study'
import { updateSession } from '../../db/study'
import { Modal, PageHeading } from '../../ui/components'
import { formatClock, formatStudyTime, shortDate } from '../../ui/format'
import { QuickStudy } from '../dashboard/Dashboard'

import { useNoteDrafts } from '../notes/useNoteDrafts'
import { readCheckpoint, saveCheckpoint } from './checkpoint'
import './session.css'

const NotesMarkdown = lazy(() => import('../notes/NotesPage').then((module) => ({ default: module.NotesMarkdown })))

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Não foi possível salvar. Tente novamente.'

export function StudyPlanner({
  sessions, recommendation, minutes, setMinutes, onStart, onOpenSession, busy,
}: {
  sessions: Session[]
  recommendation: Recommendation | null
  minutes: number
  setMinutes: (value: number) => void
  onStart: () => void
  onOpenSession: (id: string) => void
  busy: boolean
}) {
  const resumable = sessions.filter((item) => item.status !== 'completed').sort((a, b) => b.updatedAt - a.updatedAt)
  return (
    <>
      <PageHeading title="Estudar agora" description="Escolha um tempo disponível para a sua próxima sessão." />
      <div className="session-grid planner-grid">
        <QuickStudy recommendation={recommendation} minutes={minutes} setMinutes={setMinutes} onStart={onStart} running={resumable.some((session) => session.status === 'running')} busy={busy} />
        <section className="card session-card">
          <h2>Sessões para retomar</h2>
          {resumable.length ? (
            <ul className="session-queue">
              {resumable.map((item) => (
                <li key={item.id}>
                  <span className="empty-icon"><RotateCcw size={19} /></span>
                  <div><strong>{item.title}</strong><p>{formatStudyTime(getElapsedMs(item))} estudados · {shortDate.format(item.updatedAt)}</p></div>
                  <button className="button button-secondary" onClick={() => onOpenSession(item.id)}>Abrir</button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state"><span className="empty-icon"><Clock3 size={21} /></span><strong>Nenhuma sessão interrompida</strong><p>Quando você pausar, seu ponto de retomada aparecerá aqui.</p></div>
          )}
        </section>
      </div>
    </>
  )
}

type WorkspaceProps = {
  session: Session
  nodes: CurriculumNode[]
  materials: Material[]
  notes: Note[]
  busy: boolean
  onResume: () => void
  onPause: () => void
  onFinish: (completeNode: boolean) => Promise<boolean>
  onNotes: (topicId?: string, noteId?: string, sessionId?: string) => void
  onBack: () => void
}

export function StudyWorkspace({ session, nodes, materials, notes: persistedNotes, busy, onResume, onPause, onFinish, onNotes, onBack }: WorkspaceProps) {
  const [now, setNow] = useState(Date.now)
  const [checkpoint, setCheckpoint] = useState(() => readCheckpoint(session.id, session.checkpoint))
  const [checkpointError, setCheckpointError] = useState('')
  const [showFinish, setShowFinish] = useState(false)
  const [completeNode, setCompleteNode] = useState(false)
  const [preview, setPreview] = useState(false)
  const [notedMaterial, setNotedMaterial] = useState<string>()
  const [materialLinkError, setMaterialLinkError] = useState('')
  const { notes, drafts, write } = useNoteDrafts(persistedNotes)
  const node = nodes.find((item) => item.id === session.nodeId)
  const topic = nodes.find((item) => item.id === session.topicId)
  const noteId = session.noteId ?? `session-note-${session.id}`
  const note = notes.find((item) => item.id === noteId)
  const linkedNotes = notes.filter((item) => item.sessionId === session.id && item.id !== noteId)
  const noteStatus = drafts[noteId]?.status
  const status = session.status
  const elapsed = getElapsedMs(session, now)
  const planned = session.plannedMinutes * MINUTE_MS
  const timedOut = elapsed >= planned
  const progress = Math.min(100, elapsed / planned * 100)
  const ids = new Set([...(node?.materialIds ?? []), ...(topic?.materialIds ?? []), session.materialId])
  const available = materials.filter((item) => ids.has(item.id))
  const currentMaterial = available.find((item) => item.id === (notedMaterial ?? session.materialId))

  useEffect(() => {
    if (status !== 'running') return
    setNow(Date.now())
    const interval = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(interval)
  }, [status])

  function editCheckpoint(value: string) {
    setCheckpoint(value)
    setCheckpointError('')
    void saveCheckpoint(session.id, value).catch(() => setCheckpointError('O salvamento falhou. Tente salvar novamente.'))
  }

  async function selectMaterial(id: string) {
    setNotedMaterial(id)
    setMaterialLinkError('')
    try {
      await updateSession(session.id, { materialId: id || undefined })
    } catch (error) {
      setMaterialLinkError(errorMessage(error))
    }
  }

  function editNote(content: string) {
    const nextNote = {
      id: noteId, title: note?.title ?? `Sessão · ${session.title}`,
      content, tags: note?.tags ?? [], favorite: note?.favorite ?? false, question: note?.question ?? false,
      topicId: session.topicId, sessionId: session.id, projectId: note?.projectId,
      updatedAt: Math.max(Date.now(), (note?.updatedAt ?? 0) + 1),
    }
    write(nextNote)
  }

  return (
    <>
      <PageHeading title={session.title} description={topic && topic.id !== node?.id ? topic.title : 'Sessão de estudo'} action={<button className="button button-secondary" onClick={onBack}>Ver sessões</button>} />
      <div className="session-grid">
        <section className="card session-card timer-card">
          <div className={`session-state session-state-${status}`}><span />{status === 'running' ? 'Em andamento' : status === 'paused' ? 'Sessão pausada' : 'Sessão concluída'}</div>
          <div className="timer-ring" style={{ background: `conic-gradient(var(--timer-fill) ${progress}%, var(--line) ${progress}%)` }}>
            <div className="timer-inner">
              <Clock3 size={22} />
              <span className="timer-time" role="timer" aria-label="Tempo estudado">{formatClock(elapsed)}</span>
              <span>de {session.plannedMinutes} min planejados</span>
            </div>
          </div>
          {timedOut && status === 'running' && <p className="timer-hint">Tempo planejado atingido.</p>}
          <div className="timer-actions">
            {status === 'paused' && node && <button className="button button-primary" onClick={onResume} disabled={busy}><Play size={17} />Retomar cronômetro</button>}
            {status === 'running' && <button className="button button-secondary" onClick={onPause} disabled={busy}><CirclePause size={17} />Pausar sessão</button>}
            {status !== 'completed' && <button className={`button ${status === 'running' ? 'button-primary' : 'button-secondary'}`} onClick={() => { setShowFinish(true); setCompleteNode(false) }} disabled={busy}><Check size={17} />Finalizar sessão</button>}
          </div>
          {status === 'paused' && !node && <p className="timer-hint">O item de estudo desta sessão foi removido da trilha.</p>}
        </section>
        <section className="card session-card context-card">
          <header><span className="empty-icon"><Layers3 size={19} /></span><div><h2>{status === 'paused' ? 'Resumo para retomar' : 'Contexto da sessão'}</h2><p>{status === 'paused' ? 'Confira seu ponto de retomada antes de voltar.' : 'O material e o ponto de retomada ficam com a sessão.'}</p></div></header>
          <label className="field">Onde eu parei?
            <textarea value={checkpoint} rows={4} onChange={(event) => editCheckpoint(event.target.value)} placeholder="Ex. revisar a diferença entre memória e armazenamento." />
          </label>
          {checkpointError && <div className="session-error"><p className="error-text" role="alert">{checkpointError}</p><button className="button button-secondary" onClick={() => editCheckpoint(checkpoint)}>Tentar novamente</button></div>}
          {available.length ? (
            <div className="session-material">
              <label className="field">Material aberto
                <select value={currentMaterial?.id ?? ''} onChange={(event) => void selectMaterial(event.target.value)}>
                  <option value="">Escolher material</option>
                  {available.map((material) => <option value={material.id} key={material.id}>{material.title}</option>)}
                </select>
              </label>
              {currentMaterial && <a className="button button-secondary" href={currentMaterial.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15} />Abrir material</a>}
            </div>
          ) : <p className="session-small"><BookOpen size={17} /> Nenhum material vinculado.</p>}
          {materialLinkError && <p className="error-text" role="alert">{materialLinkError}</p>}
          {node?.objectives[0] && <p className="session-small"><Target size={17} /><span><strong>Próximo passo</strong> · {node.objectives[0]}</span></p>}
        </section>
      </div>
      <section className="card session-card session-note">
        <header><span className="empty-icon"><NotebookPen size={20} /></span><div><h2>Anotações da sessão</h2><p>{noteStatus === 'saving' ? 'Salvando…' : noteStatus === 'error' ? 'Falha ao salvar' : 'Salvas neste dispositivo quando você digita'}</p></div>
          <button className="button button-secondary" onClick={() => onNotes(session.topicId, note?.id, session.id)}><FileText size={16} />Abrir caderno</button>
        </header>
        <div className="session-note-tabs" role="group" aria-label="Modo da anotação">
          <button className="button button-secondary" aria-pressed={!preview} onClick={() => setPreview(false)}>Editar</button>
          <button className="button button-secondary" aria-pressed={preview} onClick={() => setPreview(true)}>Prévia</button>
        </div>
        {preview ? <Suspense fallback={<p className="muted">Carregando a prévia…</p>}><NotesMarkdown content={note?.content ?? ''} /></Suspense> : (
          <label className="field"><span className="sr-only">Anotações em Markdown</span><textarea rows={5} value={note?.content ?? ''} onChange={(event) => editNote(event.target.value)} placeholder="Escreva ideias, dúvidas e exemplos em Markdown." /></label>
        )}
        {noteStatus === 'error' && <div className="session-error"><p className="error-text" role="alert">O rascunho continua disponível.</p><button className="button button-secondary" onClick={() => editNote(note?.content ?? '')}>Tentar novamente</button></div>}
        {!!linkedNotes.length && <ul className="session-linked-notes" aria-label="Outras anotações vinculadas">
          {linkedNotes.map((linked) => <li key={linked.id}><button className="button button-secondary" onClick={() => onNotes(session.topicId, linked.id, session.id)}><FileText size={15} />{linked.title}</button></li>)}
        </ul>}
      </section>
      {showFinish && <Modal title="Finalizar sessão" onClose={() => setShowFinish(false)}>
        <p>Você registrou {formatStudyTime(elapsed)} nesta sessão.</p>
        {node && <label className="finish-checkbox"><input type="checkbox" checked={completeNode} onChange={(event) => setCompleteNode(event.target.checked)} /> Marcar {node.kind === 'topic' ? 'o tópico' : 'a atividade'} como concluído{node.kind === 'activity' ? 'a' : ''}</label>}
        <div className="modal-actions"><button className="button button-secondary" onClick={() => setShowFinish(false)}>Cancelar</button><button className="button button-primary" disabled={busy} onClick={() => void onFinish(completeNode).then((success) => { if (success) setShowFinish(false) })}>Finalizar</button></div>
      </Modal>}
    </>
  )
}

export function InterruptionDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [checkpoint, setCheckpoint] = useState(() => readCheckpoint(session.id, session.checkpoint))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  function save(value: string) {
    setError('')
    return saveCheckpoint(session.id, value).catch((failure) => { setError(errorMessage(failure)); throw failure })
  }
  return (
    <Modal title="Sessão pausada" onClose={onClose}>
      <p className="interruption-summary"><PhoneIncoming size={19} /> {formatStudyTime(session.elapsedMs)} de estudo registrados.</p>
      <label className="field">Onde eu parei?
        <textarea rows={3} value={checkpoint} onChange={(event) => { setCheckpoint(event.target.value); void save(event.target.value).catch(() => {}) }} placeholder="Uma frase para retomar depois, se quiser." />
      </label>
      {error && <p role="alert" className="error-text">{error}</p>}
      <div className="modal-actions">
        <button className="button button-primary" disabled={saving} onClick={() => {
          setSaving(true)
          void save(checkpoint).then(onClose).catch(() => setSaving(false))
        }}>Voltar ao painel</button>
      </div>
    </Modal>
  )
}
