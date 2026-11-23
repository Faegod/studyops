import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Brain, CalendarDays, CheckCircle2, Clock, Layers2, Pencil, Plus, Repeat2, Trash2 } from 'lucide-react'
import { db } from '../../db/database'
import type { CurriculumNode, Review } from '../../domain/types'
import { Modal, PageHeading } from '../../ui/components'
import { NotesMarkdown } from '../notes/NotesPage'
import { addDays, fromDateInput, toDateInput } from './resourceUtils'
import './resources.css'

type ReviewsPageProps = {
  reviews: Review[]
  nodes: CurriculumNode[]
  reviewId?: string
  onNotify: (message: string) => void
}

const intervals = [1, 3, 7, 14, 30]
const kinds: Review['kind'][] = ['flashcard', 'pergunta', 'tópico']
const confidenceLevels: NonNullable<Review['confidence']>[] = ['baixa', 'média', 'alta']
const formattedDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
const filters = [
  { value: 'pending', label: 'Pendentes' },
  { value: 'due', label: 'Para hoje' },
  { value: 'completed', label: 'Concluídas' },
] as const
type Filter = (typeof filters)[number]['value']

function newReview(): Review {
  const now = Date.now()
  return {
    id: crypto.randomUUID(), kind: 'flashcard', question: '', answer: '',
    dueAt: fromDateInput(toDateInput(addDays(now, intervals[0]))), intervalIndex: 0, updatedAt: now,
  }
}

function isDue(review: Review, now: number) {
  return !review.completedAt && toDateInput(review.dueAt) <= toDateInput(now)
}

export default function ReviewsPage({ reviews, nodes, reviewId, onNotify }: ReviewsPageProps) {
  const [filter, setFilter] = useState<Filter>('pending')
  const [draft, setDraft] = useState<Review>()
  const [pendingRemoval, setPendingRemoval] = useState<Review>()
  const [activeReview, setActiveReview] = useState<Review>()
  const [revealed, setRevealed] = useState(false)
  const [confidence, setConfidence] = useState<Review['confidence']>()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [openedFromRoute, setOpenedFromRoute] = useState<string | undefined>()
  const topics = nodes.filter((node) => node.kind === 'topic')
  const topicNames = new Map(topics.map((topic) => [topic.id, topic.title]))
  const now = Date.now()
  const due = reviews.filter((review) => isDue(review, now))
  const scheduled = reviews.filter((review) => !review.completedAt && !isDue(review, now))
  const completed = reviews.filter((review) => review.completedAt)
  const visible = (filter === 'completed' ? completed : filter === 'due' ? due : [...due, ...scheduled])
    .sort((first, second) => filter === 'completed'
      ? (second.completedAt ?? 0) - (first.completedAt ?? 0)
      : first.dueAt - second.dueAt)

  useEffect(() => {
    if (!reviewId) {
      setOpenedFromRoute(undefined)
      return
    }
    if (reviewId === openedFromRoute) return
    const review = reviews.find((candidate) => candidate.id === reviewId)
    if (!review) return
    setOpenedFromRoute(reviewId)
    if (review.completedAt) {
      setFilter('completed')
      return
    }
    setFilter('pending')
    setError('')
    setConfidence(undefined)
    setRevealed(false)
    setActiveReview(review)
  }, [reviewId, openedFromRoute, reviews])

  function openEditor(review: Review) {
    setError('')
    setDraft(review)
  }

  function openReview(review: Review) {
    setError('')
    setConfidence(undefined)
    setRevealed(false)
    setActiveReview(review)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!draft || saving) return
    const question = draft.question.trim()
    const answer = draft.answer.trim()
    if (!question || (draft.kind === 'flashcard' && !answer) || !Number.isFinite(draft.dueAt)) {
      setError('Preencha a pergunta, a data e a resposta se estiver criando um flashcard.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await db.reviews.put({ ...draft, question, answer, updatedAt: Date.now() })
      setDraft(undefined)
      onNotify('Revisão salva.')
    } catch {
      setError('Não foi possível salvar a revisão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!pendingRemoval || saving) return
    setSaving(true)
    setError('')
    try {
      await db.reviews.delete(pendingRemoval.id)
      setPendingRemoval(undefined)
      onNotify('Revisão excluída.')
    } catch {
      setError('Não foi possível excluir a revisão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function recordReview() {
    if (!activeReview || !confidence || saving) return
    setSaving(true)
    setError('')
    try {
      const timestamp = Date.now()
      const next = await db.transaction('rw', db.reviews, async () => {
        const current = await db.reviews.get(activeReview.id)
        if (!current || current.completedAt || current.lastReviewedAt !== activeReview.lastReviewedAt ||
          current.intervalIndex !== activeReview.intervalIndex) return undefined
        const nextIndex = current.intervalIndex + 1
        const complete = nextIndex >= intervals.length
        const dueAt = complete ? current.dueAt : fromDateInput(toDateInput(addDays(timestamp, intervals[nextIndex])))
        await db.reviews.update(current.id, {
          intervalIndex: complete ? current.intervalIndex : nextIndex,
          dueAt,
          confidence,
          lastReviewedAt: timestamp,
          updatedAt: timestamp,
          completedAt: complete ? timestamp : undefined,
        })
        return complete ? 'Série de revisões concluída.' : 'Revisão registrada. Próxima em ' + formattedDate.format(dueAt) + '.'
      })
      setActiveReview(undefined)
      onNotify(next ?? 'A revisão já foi atualizada.')
    } catch {
      setError('Não foi possível registrar a revisão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function reactivate(review: Review) {
    if (saving) return
    setSaving(true)
    try {
      const timestamp = Date.now()
      await db.reviews.update(review.id, { completedAt: undefined, intervalIndex: 0, dueAt: timestamp, updatedAt: timestamp })
      setFilter('due')
      onNotify('Revisão reativada.')
    } catch {
      onNotify('Não foi possível reativar a revisão.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="study-resource">
      <PageHeading title="Revisões" description="Reforce o que aprendeu com perguntas e revisões espaçadas."
        action={<button className="button button-primary" onClick={() => openEditor(newReview())}><Plus size={18} /> Nova revisão</button>} />

      <div className="study-review-overview">
        {[
          { icon: Clock, value: due.length, label: 'Para hoje' },
          { icon: CalendarDays, value: scheduled.length, label: 'Agendadas' },
          { icon: CheckCircle2, value: completed.length, label: 'Séries concluídas' },
        ].map(({ icon: Icon, value, label }) => (
          <div className="card study-review-metric" key={label}>
            <span className="empty-icon"><Icon size={20} /></span>
            <div><strong>{value}</strong><p>{label}</p></div>
          </div>
        ))}
      </div>

      <div className="study-resource-tabs" aria-label="Filtrar revisões">
        {filters.map(({ value, label }) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
      {visible.length ? (
        <div className="study-review-list">
          {visible.map((review) => {
            const topic = review.topicId ? topicNames.get(review.topicId) : undefined
            const dueToday = isDue(review, now)
            return (
              <article className={'card study-review-row' + (review.id === reviewId ? ' study-resource-selected' : '')} key={review.id}>
                <span className="empty-icon">{review.kind === 'flashcard' ? <Layers2 size={20} /> : <Repeat2 size={20} />}</span>
                <div className="study-review-description">
                  <div className="study-resource-tags"><span className="badge">{review.kind}</span>
                    {dueToday && <span className="badge study-review-due">Para hoje</span>}
                    {review.confidence && <span className="muted">Confiança {review.confidence}</span>}
                  </div>
                  <h2>{review.question}</h2>
                  <p>{topic && topic + ' · '}{review.completedAt
                    ? 'Concluída em ' + formattedDate.format(review.completedAt)
                    : formattedDate.format(review.dueAt) + ' · Etapa ' + Math.min(review.intervalIndex + 1, intervals.length) + ' de ' + intervals.length}</p>
                </div>
                <div className="study-resource-actions">
                  <button className="icon-button" aria-label={'Editar ' + review.question} title="Editar revisão" onClick={() => openEditor(review)}><Pencil size={16} /></button>
                  <button className="icon-button" aria-label={'Excluir ' + review.question} title="Excluir revisão" onClick={() => { setPendingRemoval(review); setError('') }}><Trash2 size={16} /></button>
                  {review.completedAt
                    ? <button className="button button-secondary" disabled={saving} onClick={() => void reactivate(review)}>Reativar</button>
                    : <button className={'button ' + (dueToday ? 'button-primary' : 'button-secondary')} onClick={() => openReview(review)}>Revisar</button>}
                </div>
              </article>
            )
          })}
        </div>
      ) : <div className="empty-state">
        <span className="empty-icon"><Repeat2 size={22} /></span>
        <strong>{filter === 'due' ? 'Tudo em dia' : filter === 'completed' ? 'Nenhuma série concluída' : 'Nenhuma revisão pendente'}</strong>
        <p>{filter === 'completed' ? 'As séries aparecem aqui depois da última revisão.' : 'Crie um flashcard ou conclua um tópico para começar.'}</p>
        {filter === 'pending' && <button className="button button-secondary" onClick={() => openEditor(newReview())}><Plus size={16} /> Criar flashcard</button>}
      </div>}

      {draft && (
        <Modal title={reviews.some((review) => review.id === draft.id) ? 'Editar revisão' : 'Nova revisão'} onClose={() => { if (!saving) setDraft(undefined) }}>
          <form onSubmit={(event) => void save(event)}>
            <fieldset className="study-resource-form" disabled={saving}>
              <div className="study-resource-form-row">
                <label className="field">Tipo<select value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value as Review['kind'] })}>
                  {kinds.map((kind) => <option key={kind}>{kind}</option>)}
                </select></label>
                <label className="field">Data da revisão<input type="date" required value={Number.isFinite(draft.dueAt) ? toDateInput(draft.dueAt) : ''}
                  onChange={(event) => setDraft({ ...draft, dueAt: fromDateInput(event.target.value) })} /></label>
              </div>
              <label className="field">Tópico<select value={draft.topicId ?? ''} onChange={(event) => setDraft({ ...draft, topicId: event.target.value || undefined })}>
                <option value="">Nenhum</option>
                {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
              </select></label>
              <label className="field">Pergunta<textarea required autoFocus rows={2} value={draft.question} onChange={(event) => setDraft({ ...draft, question: event.target.value })} /></label>
              <label className="field">Resposta<textarea rows={3} required={draft.kind === 'flashcard'} value={draft.answer}
                placeholder={draft.kind === 'flashcard' ? 'O que você espera lembrar?' : 'Opcional'} onChange={(event) => setDraft({ ...draft, answer: event.target.value })} /></label>
            </fieldset>
            {error && <div className="error-text" role="alert">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="button button-secondary" disabled={saving} onClick={() => setDraft(undefined)}>Cancelar</button>
              <button className="button button-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar revisão'}</button>
            </div>
          </form>
        </Modal>
      )}
      {activeReview && (
        <Modal title="Fazer revisão" onClose={() => { if (!saving) setActiveReview(undefined) }}>
          <div className="study-review-player">
            <span className="empty-icon"><Brain size={24} /></span>
            <h3>{activeReview.question}</h3>
            {!revealed && <p>Tente responder de memória antes de avaliar sua confiança.</p>}
            {!revealed ? (
              <button className="button button-secondary" onClick={() => setRevealed(true)}>{activeReview.answer ? 'Mostrar resposta' : 'Avaliar confiança'}</button>
            ) : (
              <>
                {activeReview.answer && <div className="study-review-answer"><NotesMarkdown content={activeReview.answer} /></div>}
                <fieldset className="study-review-confidence" disabled={saving}>
                  <legend>Como está sua confiança?</legend>
                  {confidenceLevels.map((level) => <label key={level} className="button button-secondary">
                    <input type="radio" name="review-confidence" value={level} checked={confidence === level} onChange={() => setConfidence(level)} />
                    {level}
                  </label>)}
                </fieldset>
              </>
            )}
            {error && <div className="error-text" role="alert">{error}</div>}
            <div className="modal-actions">
              <button className="button button-secondary" disabled={saving} onClick={() => setActiveReview(undefined)}>Fechar</button>
              <button className="button button-primary" disabled={!confidence || saving} onClick={() => void recordReview()}>{saving ? 'Registrando…' : 'Registrar revisão'}</button>
            </div>
          </div>
        </Modal>
      )}
      {pendingRemoval && (
        <Modal title="Excluir revisão?" onClose={() => { if (!saving) setPendingRemoval(undefined) }}>
          <p>A pergunta e o agendamento serão removidos.</p>
          {error && <div className="error-text" role="alert">{error}</div>}
          <div className="modal-actions">
            <button className="button button-secondary" disabled={saving} onClick={() => setPendingRemoval(undefined)}>Cancelar</button>
            <button className="button button-danger" disabled={saving} onClick={() => void remove()}>{saving ? 'Excluindo…' : 'Excluir revisão'}</button>
          </div>
        </Modal>
      )}
    </section>
  )
}
