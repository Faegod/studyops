import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import {
  BookOpen, ChartNoAxesCombined, CheckCircle2, ChevronRight, FolderKanban, GraduationCap,
  HardDrive, Layers3, LayoutDashboard, LibraryBig, LogOut, Menu, Moon, NotebookPen, PhoneIncoming,
  RotateCcw, Search, Settings as SettingsIcon, Sun, X, Zap,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getRecommendation } from './domain/study'
import type { Session } from './domain/types'
import { finishSession, pauseSession, resumeSession, saveSettings, startSession } from './db/study'
import Dashboard from './features/dashboard/Dashboard'
import CurriculumPage from './features/curriculum/CurriculumPage'
import { InterruptionDialog, StudyPlanner, StudyWorkspace } from './features/session/StudyWorkspace'
import { readCheckpoint } from './features/session/checkpoint'
import SearchModal from './features/search/SearchModal'
import { readWorkspace, useLocalDatabase } from './ui/useLocalDatabase'
import { useStudyNotice } from './ui/useStudyNotice'

const NotesPage = lazy(() => import('./features/notes/NotesPage'))
const LibraryPage = lazy(() => import('./features/resources/LibraryPage'))
const ProjectsPage = lazy(() => import('./features/resources/ProjectsPage'))
const ReviewsPage = lazy(() => import('./features/resources/ReviewsPage'))
const StatisticsPage = lazy(() => import('./features/statistics/StatisticsPage'))
const PreferencesPage = lazy(() => import('./features/preferences/PreferencesPage'))

const studyNav = [
  { id: 'painel', label: 'Dashboard', title: 'Visão geral', icon: LayoutDashboard },
  { id: 'trilha', label: 'Minha Trilha', title: 'Minha Trilha', icon: GraduationCap },
  { id: 'estudar', label: 'Estudar Agora', title: 'Estudar agora', icon: Zap },
  { id: 'revisoes', label: 'Revisões', title: 'Revisões', icon: RotateCcw },
] as const
const workspaceNav = [
  { id: 'caderno', label: 'Caderno', title: 'Caderno', icon: NotebookPen },
  { id: 'projetos', label: 'Projetos', title: 'Projetos', icon: FolderKanban },
  { id: 'biblioteca', label: 'Biblioteca', title: 'Biblioteca', icon: LibraryBig },
  { id: 'estatisticas', label: 'Estatísticas', title: 'Estatísticas', icon: ChartNoAxesCombined },
  { id: 'configuracoes', label: 'Configurações', title: 'Configurações', icon: SettingsIcon },
] as const
const navigation = [...studyNav, ...workspaceNav]
type Page = (typeof navigation)[number]['id']

const subscribeHash = (listener: () => void) => {
  window.addEventListener('hashchange', listener)
  return () => window.removeEventListener('hashchange', listener)
}
const getHash = () => window.location.hash
function routePart(value = '') {
  try { return decodeURIComponent(value) } catch { return '' }
}
function routeUrl(page: Page, ...parts: (string | undefined)[]) {
  return `#${[page, ...parts.map((value) => encodeURIComponent(value ?? ''))].join('/')}`
}

export function App({ onUpdate, onSignOut }: { onUpdate?: () => void; onSignOut?: () => void } = {}) {
  const route = useSyncExternalStore(subscribeHash, getHash)
  const [requestedPage, ...parts] = route.slice(1).split('/').map(routePart)
  const currentPage = navigation.find((item) => item.id === requestedPage) ?? studyNav[0]
  const page = currentPage.id
  const [id, topicId, sessionId] = parts
  const [attempt, setAttempt] = useState(0)
  const [readError, setReadError] = useState(false)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const [selectedMinutes, setMinutes] = useState<number>()
  const [interruption, setInterruption] = useState<Session>()
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  const [updateReady, setUpdateReady] = useState(false)
  const [running, setRunning] = useState<Session>()
  const actionInProgress = useRef(false)
  const toastTimer = useRef<number | undefined>(undefined)
  const notify = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(''), 4800)
  }, [])

  const databaseStatus = useLocalDatabase(attempt, running, notify)
  const data = useLiveQuery(async () => {
    if (databaseStatus !== 'ready') return
    try { return await readWorkspace() } catch { setReadError(true) }
  }, [databaseStatus, attempt])

  const active = data?.sessions.find((session) => session.status === 'running')
  useEffect(() => { setRunning(active) }, [active])
  const theme = data?.settings.theme ?? 'system'
  const dark = theme === 'dark' || (theme === 'system' && systemDark)
  const shortcuts = data?.settings.shortcuts ?? false
  useStudyNotice(active, data?.settings.notifications ?? false, notify)

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!media) return
    const update = () => setSystemDark(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => {
    const handler = () => setUpdateReady(true)
    window.addEventListener('studyops:update-ready', handler)
    return () => window.removeEventListener('studyops:update-ready', handler)
  }, [])
  useEffect(() => () => window.clearTimeout(toastTimer.current), [])

  function navigate(target: Page, ...parameters: (string | undefined)[]) {
    window.location.hash = routeUrl(target, ...parameters)
    setMenu(false)
    document.documentElement.scrollTop = 0
  }

  async function runAction(action: () => Promise<void>) {
    if (actionInProgress.current) return false
    actionInProgress.current = true
    setBusy(true)
    try {
      await action()
      return true
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Não foi possível salvar a alteração. Tente novamente.')
      return false
    } finally {
      actionInProgress.current = false
      setBusy(false)
    }
  }

  function pause(session: Session, emergency = false) {
    const stoppedAt = Date.now()
    return runAction(async () => {
      const paused = await pauseSession(session.id, readCheckpoint(session.id, session.checkpoint), stoppedAt)
      navigate('painel')
      if (emergency) setInterruption(paused)
      else notify('Sessão pausada. Seu ponto de retomada foi salvo.')
    })
  }

  function signOut() {
    const stoppedAt = Date.now()
    return runAction(async () => {
      if (active) await pauseSession(active.id, readCheckpoint(active.id, active.checkpoint), stoppedAt)
      onSignOut?.()
    })
  }

  useEffect(() => {
    if (!shortcuts) return
    function keyboard(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault()
        setSearch(true)
      }
      if (event.altKey && key === 'p' && active) {
        event.preventDefault()
        void pause(active, true)
      }
      if (key === 'escape') setMenu(false)
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [active, shortcuts])

  if (databaseStatus === 'error' || readError) return (
    <main className="system-message" role="alert">
      <span className="empty-icon"><HardDrive size={22} /></span><h1>Não foi possível abrir seus estudos</h1>
      <p>Verifique se este navegador permite o armazenamento local e tente novamente.</p>
      <button className="button button-primary" onClick={() => { setReadError(false); setAttempt((value) => value + 1) }}>Tentar novamente</button>
    </main>
  )
  if (!data || databaseStatus !== 'ready') return <main className="system-message" role="status"><span className="brand-mark"><Layers3 size={23} /></span><h1>StudyOps</h1><p>Abrindo seus estudos…</p></main>

  const { sessions, nodes, notes, materials, projects, reviews, settings } = data
  const minutes = selectedMinutes ?? settings.defaultMinutes
  const recommendation = getRecommendation(nodes, sessions, minutes, reviews, settings)
  const openSession = (session: string) => navigate('estudar', session)
  const openNotes = (topic?: string, note?: string, session?: string) => navigate('caderno', note, topic, session)
  const openTrail = (node?: string) => node ? navigate('trilha', node) : navigate('trilha')

  function startNode(nodeId: string, duration = minutes) {
    const previous = sessions.filter((session) => session.nodeId === nodeId && session.status !== 'completed').sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (previous) { openSession(previous.id); return }
    const node = nodes.find((item) => item.id === nodeId)
    const planned = Math.min(duration, node?.minutes ?? duration)
    void runAction(async () => {
      const session = await startSession(nodeId, planned)
      openSession(session.id)
    })
  }

  function startRecommendation() {
    if (active) { openSession(active.id); return }
    if (recommendation?.session) { openSession(recommendation.session.id); return }
    if (recommendation?.review) { navigate('revisoes', recommendation.review.id); return }
    if (recommendation?.node) startNode(recommendation.node.id, recommendation.minutes)
  }

  function navLink(event: MouseEvent<HTMLAnchorElement>, target: Page) {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
    event.preventDefault()
    navigate(target)
  }

  let content: ReactNode
  switch (page) {
    case 'painel':
      content = <Dashboard {...{ nodes, sessions, reviews, settings, minutes, setMinutes, recommendation, busy }} onStartRecommendation={startRecommendation} onStartNode={startNode} onOpenSession={openSession} onOpenTrail={openTrail} onOpenStats={() => navigate('estatisticas')} onOpenReviews={() => navigate('revisoes')} />
      break
    case 'trilha':
      content = <CurriculumPage nodes={nodes} materials={materials} notes={notes} selectedNodeId={id} onStudy={startNode} onNotes={openNotes} onNotify={notify} />
      break
    case 'estudar': {
      const session = sessions.find((item) => item.id === id)
      content = session ? <StudyWorkspace key={session.id} session={session} nodes={nodes} materials={materials} notes={notes} busy={busy}
        onResume={() => { void runAction(async () => { await resumeSession(session.id) }) }}
        onPause={() => { void pause(session) }}
        onFinish={(completeNode) => runAction(async () => {
          await finishSession(session.id, { completeNode, checkpoint: readCheckpoint(session.id, session.checkpoint) })
          navigate('painel')
          notify('Sessão finalizada e registrada no histórico.')
        })}
        onNotes={openNotes} onBack={() => navigate('estudar')} />
        : <StudyPlanner sessions={sessions} recommendation={recommendation} minutes={minutes} setMinutes={setMinutes} onStart={startRecommendation} onOpenSession={openSession} busy={busy} />
      break
    }
    case 'caderno':
      content = <NotesPage nodes={nodes} notes={notes} sessions={sessions} projects={projects} selectedNoteId={id} topicId={topicId} sessionId={sessionId} onNotify={notify} />
      break
    case 'revisoes':
      content = <ReviewsPage reviews={reviews} nodes={nodes} reviewId={id} onNotify={notify} />
      break
    case 'projetos':
      content = <ProjectsPage projects={projects} nodes={nodes} projectId={id} onNotify={notify} />
      break
    case 'biblioteca':
      content = <LibraryPage materials={materials} nodes={nodes} materialId={id} onNotify={notify} />
      break
    case 'estatisticas':
      content = <StatisticsPage sessions={sessions} nodes={nodes} settings={settings} onOpenSession={openSession} />
      break
    case 'configuracoes':
      content = <PreferencesPage settings={settings} nodes={nodes} onNotify={notify} activeTimer={!!active} />
      break
  }

  return (
    <div className={`app-shell${active ? ' app-has-session' : ''}`}>
      <a className="skip-link" href="#conteudo" onClick={(event) => { event.preventDefault(); document.getElementById('conteudo')?.focus() }}>Pular para o conteúdo</a>
      {menu && <button className="sidebar-scrim" aria-label="Fechar menu" onClick={() => setMenu(false)} />}
      <aside className={`sidebar${menu ? ' is-open' : ''}`} id="side-navigation">
        <a className="brand" href="#painel" onClick={(event) => navLink(event, 'painel')} aria-label="StudyOps, painel">
          <span className="brand-mark"><Layers3 size={23} strokeWidth={2.1} /></span>
          <span><span className="brand-name">StudyOps</span><span className="brand-caption">Formação em TI</span></span>
        </a>
        <nav aria-label="Menu principal">
          <p className="nav-label">Estudo</p>
          <div className="nav-group">
            {studyNav.map(({ id: target, label, icon: Icon }) => <a key={target} className="nav-item" href={routeUrl(target)} aria-current={page === target ? 'page' : undefined} onClick={(event) => navLink(event, target)}><Icon size={19} strokeWidth={1.9} />{label}</a>)}
          </div>
          <p className="nav-label">Área pessoal</p>
          <div className="nav-group">
            {workspaceNav.map(({ id: target, label, icon: Icon }) => <a key={target} className="nav-item" href={routeUrl(target)} aria-current={page === target ? 'page' : undefined} onClick={(event) => navLink(event, target)}><Icon size={19} strokeWidth={1.9} />{label}</a>)}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="local-status"><span className="local-icon"><HardDrive size={17} /></span><span><strong>Armazenamento local</strong><small>Dados neste dispositivo</small></span></div>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button className="icon-button mobile-menu" aria-label="Abrir menu" aria-expanded={menu} aria-controls="side-navigation" onClick={() => setMenu((visible) => !visible)}><Menu size={21} /></button>
            <BookOpen size={16} /><span>Espaço de estudo</span><ChevronRight size={14} /><strong>{currentPage.title}</strong>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => setSearch(true)} aria-label="Buscar no StudyOps"><Search size={17} /><span>Buscar...</span>{shortcuts && <kbd>Ctrl K</kbd>}</button>
            <button className="icon-button" aria-label={dark ? 'Ativar tema claro' : 'Ativar tema escuro'} title={dark ? 'Ativar tema claro' : 'Ativar tema escuro'} onClick={() => void runAction(async () => { await saveSettings({ theme: dark ? 'light' : 'dark' }) })}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            {onSignOut && <button className="icon-button" aria-label="Sair do StudyOps" title="Sair do StudyOps" onClick={() => void signOut()} disabled={busy}><LogOut size={18} /></button>}
          </div>
        </header>
        <main className="app-content" id="conteudo" tabIndex={-1}>
          {updateReady && onUpdate && <div className="update-banner" role="status"><span>Uma atualização do StudyOps está pronta.</span><button className="button button-secondary" onClick={onUpdate} disabled={!!active}>Atualizar</button></div>}
          <Suspense fallback={<p className="route-loading" role="status">Carregando…</p>}>{content}</Suspense>
        </main>
      </div>
      {active && <button className="button emergency-action" onClick={() => void pause(active, true)} disabled={busy} title={shortcuts ? 'Pausar imediatamente (Alt+P)' : 'Pausar imediatamente'}><PhoneIncoming size={18} />Chamado chegou!</button>}
      {toast && <div className="toast" role="status"><CheckCircle2 size={18} /><span>{toast}</span><button className="icon-button" aria-label="Dispensar aviso" onClick={() => setToast('')}><X size={16} /></button></div>}
      {interruption && <InterruptionDialog session={interruption} onClose={() => setInterruption(undefined)} />}
      {search && <SearchModal nodes={nodes} notes={notes} materials={materials} projects={projects} reviews={reviews} onClose={() => setSearch(false)} onOpen={(target, result) => { setSearch(false); navigate(target, result) }} />}
    </div>
  )
}
