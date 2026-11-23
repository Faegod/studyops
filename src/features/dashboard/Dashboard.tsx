import {
  Activity, BookOpen, CalendarDays, CheckCircle2, ChevronRight, Clock3, Code2,
  Layers3, ListTodo, Play, RotateCcw, Target, Timer, Zap,
} from 'lucide-react'
import { useState } from 'react'
import type { CurriculumNode, Review, Session, Settings } from '../../domain/types'
import {
  getRecommendationsOrder, getStudyTime, getTopicProgress, getWeekRange, SESSION_DURATIONS,
  type Recommendation,
} from '../../domain/study'
import { formatStudyTime, fullDate, nextDay, shortDate, startOfDay } from '../../ui/format'
import './dashboard.css'

const durationLabels = { resume: 'Sessão interrompida', review: 'Revisão vencida', activity: 'Atividade prática', topic: 'Próximo tópico' }

export function QuickStudy({ recommendation, minutes, setMinutes, onStart, running, busy }: {
  recommendation: Recommendation | null
  minutes: number
  setMinutes: (minutes: number) => void
  onStart: () => void
  running: boolean
  busy: boolean
}) {
  return (
    <section className="card quick-card" aria-labelledby="quick-heading">
      <div className="quick-heading">
        <span className="quick-icon"><Zap size={18} strokeWidth={2.25} /></span>
        <div><h2 id="quick-heading">Estudar agora</h2><p>Quanto tempo você tem?</p></div>
      </div>
      <div className="duration-picker" role="group" aria-label="Duração disponível">
        {SESSION_DURATIONS.map((option) => (
          <button key={option} type="button" aria-pressed={option === minutes} onClick={() => setMinutes(option)}>{option}<span> min</span></button>
        ))}
      </div>
      {running || recommendation ? (
        <div className="quick-recommendation">
          <div className="quick-recommendation-line">
            <span><span className="suggestion-dot" />{running ? 'Sessão em andamento' : durationLabels[recommendation!.kind]}</span>
            {!running && <span>{recommendation!.minutes} min</span>}
          </div>
          <strong>{running ? 'Sua sessão está aberta' : recommendation!.title}</strong>
        </div>
      ) : <p className="quick-recommendation muted">Adicione um tópico ou uma atividade à trilha.</p>}
      <button type="button" className="button button-primary quick-start" onClick={onStart} disabled={busy || (!running && !recommendation)}>
        {recommendation?.kind === 'review' && !running ? <RotateCcw size={16} /> : <Play size={16} />}
        {running ? 'Abrir sessão' : recommendation?.kind === 'resume' ? 'Retomar sessão' : recommendation?.kind === 'review' ? 'Abrir revisão' : 'Iniciar sessão'}
      </button>
    </section>
  )
}

function HeroArtwork() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-orbit hero-orbit-outer" />
      <div className="hero-orbit hero-orbit-middle" />
      <div className="hero-orbit hero-orbit-inner" />
      <div className="hero-art-plaque"><BookOpen size={50} strokeWidth={1.45} /></div>
      <div className="hero-art-chip chip-code"><Code2 size={23} strokeWidth={1.8} /></div>
      <div className="hero-art-chip chip-layers"><Layers3 size={22} strokeWidth={1.75} /></div>
      <div className="hero-art-chip chip-check"><CheckCircle2 size={19} strokeWidth={1.7} /></div>
      <span className="hero-spark spark-one" /><span className="hero-spark spark-two" /><span className="hero-spark spark-three" />
    </div>
  )
}

function Metric({ title, value, detail, icon: Icon, tone, progress }: {
  title: string
  value: string | number
  detail: string
  icon: typeof Clock3
  tone: string
  progress?: number
}) {
  return (
    <section className="card dashboard-metric">
      <span className={`metric-icon metric-${tone}`}><Icon size={19} strokeWidth={2} /></span>
      <div className="metric-content">
        <h2>{title}</h2>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      {progress !== undefined && <progress aria-label="Progresso da meta semanal" max={100} value={progress} />}
    </section>
  )
}

type DashboardProps = {
  nodes: CurriculumNode[]
  sessions: Session[]
  reviews: Review[]
  settings: Settings
  minutes: number
  setMinutes: (minutes: number) => void
  recommendation: Recommendation | null
  onStartRecommendation: () => void
  onStartNode: (id: string) => void
  onOpenSession: (id: string) => void
  onOpenTrail: (id?: string) => void
  onOpenStats: () => void
  onOpenReviews: () => void
  busy: boolean
}

const weekDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

export default function Dashboard({
  nodes, sessions, reviews, settings, minutes, setMinutes, recommendation, onStartRecommendation,
  onStartNode, onOpenSession, onOpenTrail, onOpenStats, onOpenReviews, busy,
}: DashboardProps) {
  const now = Date.now()
  const today = startOfDay(now)
  const [selectedDay, setSelectedDay] = useState<number>()
  const { start, end } = getWeekRange(now)
  const orderedNodes = getRecommendationsOrder(nodes, settings)
  const progress = getTopicProgress(nodes)
  const studied = getStudyTime(sessions, start, end, now)
  const running = sessions.find((session) => session.status === 'running')
  const paused = sessions.filter((session) => session.status === 'paused').sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const openSession = running ?? paused
  const nextTopic = orderedNodes.find((node) => node.kind === 'topic' && node.status !== 'completed')
  const focusNode = nodes.find((node) => node.id === (openSession?.topicId ?? openSession?.nodeId)) ?? nextTopic
  const ancestors: CurriculumNode[] = []
  let current = focusNode
  while (current && ancestors.length < 5) {
    ancestors.push(current)
    const parentId = current.parentId
    current = nodes.find((node) => node.id === parentId)
  }
  const phase = ancestors.find((node) => node.kind === 'phase')
  const discipline = ancestors.find((node) => node.kind === 'discipline')
  const upcomingReviews = reviews.filter((review) => review.completedAt === undefined).sort((a, b) => a.dueAt - b.dueAt)
  const due = upcomingReviews.filter((review) => review.dueAt <= now).length
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = nextDay(start, index)
    return { date, ms: getStudyTime(sessions, date, nextDay(date), now) }
  })
  const maxDay = Math.max(60 * 60000, ...week.map((day) => day.ms))
  const shownDay = week.find((day) => day.date === selectedDay)
  const goal = settings.weeklyGoal ? Math.min(100, Math.round(studied / (settings.weeklyGoal * 3600000) * 100)) : undefined
  const latestHistory = sessions.filter((session) => session.elapsedMs > 0 || session.status === 'completed')
    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3)
  const startHero = () => {
    if (openSession) onOpenSession(openSession.id)
    else if (nextTopic) onStartNode(nextTopic.id)
    else onOpenTrail()
  }

  return (
    <div className="dashboard">
      <header className="page-heading dashboard-heading">
        <div><h1>Painel de estudos</h1><p>Acompanhe sua formação em TI e retome de onde parou.</p></div>
        <div className="dashboard-date"><CalendarDays size={16} /><time dateTime={new Date(now).toISOString()}>{fullDate.format(now)}</time></div>
      </header>

      <div className="dashboard-top">
        <section className="study-hero" aria-label="Disciplina atual">
          <HeroArtwork />
          <div className="hero-content">
            <span className="hero-kicker"><Target size={14} /> {openSession ? 'EM ANDAMENTO' : 'SUA TRILHA ATUAL'}</span>
            <h2>{phase?.title ?? discipline?.title ?? (progress.total ? 'Trilha concluída' : 'Sua formação em TI')}</h2>
            <p>{openSession ? openSession.title : nextTopic ? <><span>Próximo tópico</span><i />{nextTopic.title}</> : 'Explore a trilha e escolha o que estudar.'}</p>
            {discipline && phase && discipline.title !== phase.title && <span className="hero-discipline">Disciplina · {discipline.title}</span>}
            <div className="hero-actions">
              <button type="button" className="button hero-primary" onClick={startHero} disabled={busy}>
                {openSession ? <RotateCcw size={15} /> : <Play size={15} />}{openSession ? 'Continuar de onde parei' : nextTopic ? 'Começar a estudar' : 'Abrir minha trilha'}
              </button>
              {(nextTopic || openSession) && <button type="button" className="button hero-secondary" onClick={() => onOpenTrail(focusNode?.id)}>Ver trilha</button>}
            </div>
          </div>
        </section>

        <QuickStudy recommendation={recommendation} minutes={minutes} setMinutes={setMinutes} running={!!running} busy={busy} onStart={onStartRecommendation} />
      </div>

      <div className="dashboard-metrics">
        <Metric title="Tempo nesta semana" value={formatStudyTime(studied)} detail={`Meta de ${settings.weeklyGoal.toLocaleString('pt-BR')} h`} icon={Clock3} tone="green" progress={goal} />
        <Metric title="Tópicos concluídos" value={progress.completed} detail={`De ${progress.total} tópicos na trilha`} icon={CheckCircle2} tone="jade" />
        <Metric title="Tópicos pendentes" value={progress.pending} detail="Na sua formação" icon={ListTodo} tone="blue" />
        <Metric title="Revisões pendentes" value={due} detail={due ? 'Disponíveis para revisar' : 'Nenhuma revisão vencida'} icon={RotateCcw} tone="amber" />
      </div>

      <div className="dashboard-lower">
        <section className="card dashboard-section">
          <header><div><h2>Ritmo de estudo</h2><p>Tempo registrado nos últimos dias desta semana</p></div>
            <button type="button" className="button section-link" onClick={onOpenStats}>Ver histórico <ChevronRight size={15} /></button>
          </header>
          <div className="week-chart">
            <div className="chart-ticks" aria-hidden="true">
              {[1, .5, 0].map((fraction) => <span key={fraction}>{formatStudyTime(maxDay * fraction)}</span>)}
            </div>
            <div className="chart-area">
              <div className="chart-rules" aria-hidden="true"><span /><span /><span /></div>
              <div className="chart-days">
                {week.map(({ date, ms }) => (
                  <button type="button" key={date} className="chart-day" onClick={() => setSelectedDay(date)} aria-pressed={selectedDay === date} aria-label={`${fullDate.format(date)}, ${formatStudyTime(ms)}`}>
                    <span className={`chart-bar${date === today ? ' today' : ''}`} style={{ height: ms > 0 ? `max(5px, ${ms / maxDay * 100}%)` : '4px' }} />
                    <span className={`chart-day-label${date === today ? ' today' : ''}`}>{weekDay.format(date).replace('.', '')}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {shownDay && <p className="chart-caption">{fullDate.format(shownDay.date)} · {formatStudyTime(shownDay.ms)}</p>}
        </section>
        <section className="card dashboard-section">
          <header><div><h2>Próximas revisões</h2><p>Reforce o que você já estudou</p></div>
            <button type="button" className="icon-button" aria-label="Abrir revisões" onClick={onOpenReviews}><ChevronRight size={19} /></button>
          </header>
          {upcomingReviews.length ? (
            <ul className="dashboard-records">
              {upcomingReviews.slice(0, 3).map((review) => <li key={review.id}><RotateCcw size={16} /><span>{nodes.find((node) => node.id === review.topicId)?.title ?? 'Revisão de tópico'}</span><time>{shortDate.format(review.dueAt)}</time></li>)}
            </ul>
          ) : (
            <div className="dashboard-empty">
              <span className="empty-icon"><CalendarDays size={21} /></span>
              <strong>Nenhuma revisão agendada</strong>
              <p>Conclua um tópico para programar a primeira revisão.</p>
            </div>
          )}
        </section>
      </div>
      <section className="card dashboard-section history-card">
        <header><div><h2>Atividade recente</h2><p>Histórico das suas sessões</p></div>
          <button type="button" className="button section-link" onClick={onOpenStats}>Abrir calendário <ChevronRight size={15} /></button>
        </header>
        {latestHistory.length ? (
          <ul className="dashboard-records">
            {latestHistory.map((session) => <li key={session.id}><Timer size={16} /><span>{session.title}</span><time>{shortDate.format(session.updatedAt)} · {formatStudyTime(session.elapsedMs)}</time></li>)}
          </ul>
        ) : <p className="dashboard-history-empty"><Activity size={17} /> Suas sessões aparecerão aqui após o primeiro estudo.</p>}
      </section>
    </div>
  )
}
