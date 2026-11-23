import { useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, CalendarRange, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, type LucideIcon } from 'lucide-react'
import { flattenCurriculum, getStudyTime, getTopicProgress, getWeekRange } from '../../domain/study'
import type { CurriculumNode, Session, Settings } from '../../domain/types'
import { PageHeading } from '../../ui/components'
import { formatStudyTime, fullDate, nextDay, shortDate, startOfDay } from '../../ui/format'
import './statistics.css'

interface StatisticsProps {
  sessions: Session[]
  nodes: CurriculumNode[]
  settings: Settings
  onOpenSession: (id: string) => void
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' })
const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const hourMs = 3_600_000
const sessionStates: Record<Session['status'], string> = {
  paused: 'Pausada',
  running: 'Em andamento',
  completed: 'Concluída',
}

function monthStart(date: number, offset = 0) {
  const value = new Date(date)
  return new Date(value.getFullYear(), value.getMonth() + offset, 1).getTime()
}

function lastStudyDate(session: Session, start: number, end: number, now: number) {
  let last = session.startedAt >= start && session.startedAt < end ? session.startedAt : undefined
  const intervals = session.status === 'running' && session.runStartedAt !== undefined
    ? [...session.segments, { start: session.runStartedAt, end: now }]
    : session.segments
  for (const interval of intervals) {
    const latest = Math.min(end, interval.end) - 1
    if (latest >= Math.max(start, interval.start)) last = Math.max(last ?? -Infinity, latest)
  }
  return last
}

function findDiscipline(id: string | undefined, nodes: Map<string, CurriculumNode>) {
  let node = id ? nodes.get(id) : undefined
  for (let depth = 0; node && depth < 5; depth++) {
    if (node.kind === 'discipline') return node.id
    node = node.parentId ? nodes.get(node.parentId) : undefined
  }
  return undefined
}

function StatMetric({ title, value, detail, icon: Icon, progress }: {
  title: string
  value: string
  detail: string
  icon: LucideIcon
  progress?: number
}) {
  return (
    <section className="card stats-metric">
      <span className="empty-icon"><Icon size={19} aria-hidden="true" /></span>
      <div>
        <h2>{title}</h2>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      {progress !== undefined && <progress aria-label="Progresso da meta semanal" max={100} value={progress} />}
    </section>
  )
}

export default function StatisticsPage({ sessions, nodes, settings, onOpenSession }: StatisticsProps) {
  const [now, setNow] = useState(Date.now)
  const [month, setMonth] = useState(() => monthStart(now))
  const [selectedDay, setSelectedDay] = useState<number>()

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  const { disciplines, nodeById, topicsByDiscipline } = useMemo(() => {
    const ordered = flattenCurriculum(nodes)
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const byDiscipline = new Map<string, CurriculumNode[]>()
    for (const topic of ordered.filter((node) => node.kind === 'topic')) {
      const id = findDiscipline(topic.id, byId)
      if (!id) continue
      const topics = byDiscipline.get(id) ?? []
      topics.push(topic)
      byDiscipline.set(id, topics)
    }
    return { disciplines: ordered.filter((node) => node.kind === 'discipline'), nodeById: byId, topicsByDiscipline: byDiscipline }
  }, [nodes])

  const today = startOfDay(now)
  const currentMonth = monthStart(now)
  const week = getWeekRange(now)
  const todayMs = getStudyTime(sessions, today, nextDay(today), now)
  const weekMs = getStudyTime(sessions, week.start, week.end, now)
  const monthMs = getStudyTime(sessions, currentMonth, monthStart(now, 1), now)
  const goalPercent = settings.weeklyGoal > 0 ? Math.min(100, Math.round(weekMs / (settings.weeklyGoal * hourMs) * 100)) : undefined
  const remainingGoal = Math.max(0, settings.weeklyGoal * hourMs - weekMs)
  const remainingDays = Array.from({ length: 7 }, (_, index) => nextDay(week.start, index)).filter((date) =>
    date >= today && settings.availableDays.includes(new Date(date).getDay()),
  ).length
  const timePerDay = remainingGoal > 0 && remainingDays > 0
    ? Math.ceil(remainingGoal / remainingDays / 60_000) * 60_000
    : 0
  const progress = getTopicProgress(nodes)
  const dateFrom = new Date(month)
  const monthEnd = monthStart(month, 1)
  const visibleSessions = sessions.filter((session) => lastStudyDate(session, month, monthEnd, now) !== undefined)
  const daysBeforeMonth = (dateFrom.getDay() + 6) % 7
  const daysInMonth = new Date(dateFrom.getFullYear(), dateFrom.getMonth() + 1, 0).getDate()
  const periodStart = selectedDay ?? month
  const periodEnd = selectedDay === undefined ? monthEnd : nextDay(selectedDay)
  const periodLabel = selectedDay === undefined ? monthFormatter.format(month) : fullDate.format(selectedDay)
  const history = visibleSessions.flatMap((session) => {
    const date = lastStudyDate(session, periodStart, periodEnd, now)
    if (date === undefined) return []
    return [{ session, date, ms: getStudyTime([session], periodStart, periodEnd, now) }]
  }).sort((left, right) => right.date - left.date)

  const timeByDiscipline = new Map<string | undefined, number>()
  for (const { session, ms } of history) {
    const id = findDiscipline(session.nodeId, nodeById) ?? findDiscipline(session.topicId, nodeById)
    timeByDiscipline.set(id, (timeByDiscipline.get(id) ?? 0) + ms)
  }

  function showMonth(offset: number) {
    setMonth((value) => monthStart(value, offset))
    setSelectedDay(undefined)
  }

  function showToday() {
    const date = Date.now()
    setNow(date)
    setMonth(monthStart(date))
    setSelectedDay(startOfDay(date))
  }

  return (
    <div className="stats-page">
      <PageHeading title="Estatísticas" description="Acompanhe o tempo de estudo e o progresso na sua formação."
        action={<button type="button" className="button button-secondary" onClick={showToday}><CalendarDays size={17} aria-hidden="true" /> Hoje</button>} />

      <div className="stats-metrics">
        <StatMetric title="Hoje" value={formatStudyTime(todayMs)} detail="Tempo registrado" icon={Clock3} />
        <StatMetric title="Esta semana" value={formatStudyTime(weekMs)} detail={`Meta de ${settings.weeklyGoal.toLocaleString('pt-BR')} h`}
          icon={CalendarRange} progress={goalPercent} />
        <StatMetric title="Este mês" value={formatStudyTime(monthMs)} detail={monthFormatter.format(now)} icon={CalendarDays} />
        <StatMetric title="Tópicos concluídos" value={String(progress.completed)} detail={`De ${progress.total} na sua trilha`} icon={CheckCircle2} />
      </div>

      <div className="stats-layout">
        <section className="card stats-panel" aria-labelledby="study-calendar">
          <header className="stats-panel-header">
            <div><h2 id="study-calendar">Calendário de estudos</h2><p>Selecione uma data para filtrar as sessões.</p></div>
          </header>
          <div className="stats-calendar-toolbar">
            <h3 aria-live="polite">{monthFormatter.format(month)}</h3>
            <div className="stats-calendar-controls">
              <button type="button" className="icon-button" aria-label="Mês anterior" onClick={() => showMonth(-1)}><ChevronLeft size={19} aria-hidden="true" /></button>
              <button type="button" className="icon-button" aria-label="Próximo mês" onClick={() => showMonth(1)}><ChevronRight size={19} aria-hidden="true" /></button>
            </div>
          </div>
          <div className="stats-calendar">
            {weekdayLabels.map((label) => <span className="stats-weekday" key={label} aria-hidden="true">{label}</span>)}
            {Array.from({ length: daysBeforeMonth }, (_, index) => <span key={`gap-${index}`} aria-hidden="true" />)}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const date = nextDay(month, index)
              const time = getStudyTime(visibleSessions, date, nextDay(date), now)
              const available = settings.availableDays.includes(new Date(date).getDay())
              return (
                <button
                  type="button"
                  className={`stats-day${time > 0 ? ' stats-day-studied' : ''}`}
                  key={date}
                  aria-label={`${dayFormatter.format(date)}${time > 0 ? `, ${formatStudyTime(time)} de estudo` : available ? ', dia disponível' : ''}`}
                  aria-pressed={selectedDay === date}
                  aria-current={date === today ? 'date' : undefined}
                  onClick={() => setSelectedDay((current) => current === date ? undefined : date)}
                >
                  <span>{index + 1}</span>
                  {time > 0 ? <small>{formatStudyTime(time)}</small> : available ? <span className="stats-available-day" aria-hidden="true" /> : null}
                </button>
              )
            })}
          </div>
          <div className="stats-calendar-legend"><span><i /> Estudo registrado</span><span><i /> Dia disponível</span></div>
          {timePerDay > 0 && <p className="stats-week-plan">Para alcançar a meta desta semana, planeje {formatStudyTime(timePerDay)} por dia disponível a partir de hoje.</p>}
        </section>

        <section className="card stats-panel" aria-labelledby="study-history">
          <header className="stats-panel-header">
            <div><h2 id="study-history">Histórico de estudos</h2><p className="stats-period">{periodLabel}</p></div>
            {selectedDay !== undefined && <button type="button" className="button button-secondary" onClick={() => setSelectedDay(undefined)}>Todo o mês</button>}
          </header>
          {history.length ? (
            <ul className="stats-history">
              {history.map(({ session, date, ms }) => (
                <li key={session.id}>
                  <span className="empty-icon"><History size={18} aria-hidden="true" /></span>
                  <div className="stats-history-text">
                    <button type="button" className="stats-history-link" onClick={() => onOpenSession(session.id)}>{session.title}</button>
                    <p><time dateTime={new Date(date).toISOString()}>{shortDate.format(date)}</time> · {formatStudyTime(ms)}</p>
                  </div>
                  <span className={`stats-session-state stats-session-${session.status}`}>{sessionStates[session.status]}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state"><span className="empty-icon"><History size={21} aria-hidden="true" /></span>
              <strong>Nenhuma sessão neste período</strong><p>As sessões registradas aparecem aqui.</p>
            </div>
          )}
        </section>
      </div>

      <section className="card stats-panel" aria-labelledby="study-disciplines">
        <header className="stats-panel-header">
          <div><h2 id="study-disciplines">Progresso por disciplina</h2><p>Tempo no período selecionado e tópicos concluídos na trilha.</p></div>
        </header>
        {disciplines.length || timeByDiscipline.has(undefined) ? (
          <table className="stats-disciplines">
            <thead><tr><th scope="col">Disciplina</th><th scope="col">Tempo estudado</th><th scope="col">Tópicos concluídos</th></tr></thead>
            <tbody>
              {disciplines.map((discipline) => {
                const totals = getTopicProgress(topicsByDiscipline.get(discipline.id) ?? [])
                return (
                  <tr key={discipline.id}>
                    <th scope="row">{discipline.title}</th>
                    <td>{formatStudyTime(timeByDiscipline.get(discipline.id) ?? 0)}</td>
                    <td>{totals.completed} de {totals.total}</td>
                  </tr>
                )
              })}
              {timeByDiscipline.has(undefined) && (
                <tr><th scope="row">Sem disciplina vinculada</th><td>{formatStudyTime(timeByDiscipline.get(undefined) ?? 0)}</td><td>—</td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="empty-state"><span className="empty-icon"><BookOpen size={21} aria-hidden="true" /></span>
            <strong>Nenhuma disciplina cadastrada</strong><p>Adicione uma disciplina em Minha Trilha para acompanhar o progresso.</p>
          </div>
        )}
      </section>
    </div>
  )
}
