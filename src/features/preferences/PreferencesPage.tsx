import { useRef, useState } from 'react'
import { Bell, ChevronDown, ChevronUp, Clock3, Database, Download, Monitor, ShieldCheck, Upload, X } from 'lucide-react'
import type { CurriculumNode, Settings } from '../../domain/types'
import { SESSION_DURATIONS, flattenCurriculum } from '../../domain/study'
import { exportBackup, importBackup, validateBackup, type StudyOpsBackup } from '../../db/backup'
import { db } from '../../db/database'
import { saveSettings } from '../../db/study'
import { Modal, PageHeading } from '../../ui/components'
import { clearCheckpoints, readCheckpoint, saveCheckpoint } from '../session/checkpoint'
import { clearPendingNoteDrafts, persistPendingNoteDrafts } from '../notes/useNoteDrafts'
import './preferences.css'

const days = [
  [1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom'],
] as const

type ImportMode = 'merge' | 'replace'

function getError(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Clock3; title: string; description: string }) {
  return <header className="preferences-section-title"><span className="empty-icon"><Icon size={20} /></span><div><h2>{title}</h2><p>{description}</p></div></header>
}

async function flushProgress() {
  await persistPendingNoteDrafts()
  const sessions = await db.sessions.toArray()
  await Promise.all(sessions.map(({ id, checkpoint }) => {
    const latest = readCheckpoint(id, checkpoint)
    return latest !== checkpoint ? saveCheckpoint(id, latest) : undefined
  }))
}

export default function PreferencesPage({ settings, nodes, onNotify, activeTimer = false }: {
  settings: Settings
  nodes: CurriculumNode[]
  onNotify: (message: string) => void
  activeTimer?: boolean
}) {
  const [goal, setGoal] = useState(String(settings.weeklyGoal))
  const [error, setError] = useState('')
  const [backupError, setBackupError] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [pending, setPending] = useState<{ name: string; data: StudyOpsBackup }>()
  const [mode, setMode] = useState<ImportMode>('merge')
  const [confirmed, setConfirmed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const priorities = flattenCurriculum(nodes).filter((node) => ['phase', 'discipline', 'topic'].includes(node.kind))
  const activePriorities = settings.priorityIds.flatMap((id) => priorities.find((node) => node.id === id) ?? [])

  function movePriority(index: number, offset: -1 | 1) {
    const priorityIds = activePriorities.map((node) => node.id)
    const [id] = priorityIds.splice(index, 1)
    priorityIds.splice(index + offset, 0, id)
    void update({ priorityIds })
  }

  async function update(changes: Partial<Omit<Settings, 'id'>>, success?: string) {
    setError('')
    try {
      await saveSettings(changes)
      if (success) onNotify(success)
    } catch (failure) { setError(getError(failure)) }
  }

  async function configureNotifications(enabled: boolean) {
    if (enabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* The app also has an in-app notice. */ }
    }
    await update({ notifications: enabled })
  }

  async function download() {
    setBackupBusy(true)
    setBackupError('')
    try {
      await flushProgress()
      const data = await exportBackup()
      const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(file)
      const anchor = document.createElement('a')
      const date = new Date().toLocaleDateString('sv-SE')
      anchor.href = url
      anchor.download = `studyops-${date}.json`
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      onNotify('Backup exportado.')
    } catch (failure) { setBackupError(getError(failure)) } finally { setBackupBusy(false) }
  }

  async function readFile(file?: File) {
    if (!file) return
    setBackupBusy(true)
    setBackupError('')
    try {
      const data = validateBackup(JSON.parse(await file.text()) as unknown)
      setPending({ name: file.name, data })
      setMode('merge')
      setConfirmed(false)
    } catch (failure) {
      setBackupError(failure instanceof SyntaxError ? 'O arquivo não contém JSON válido.' : getError(failure))
    } finally { setBackupBusy(false) }
  }

  async function restore() {
    if (!pending || activeTimer || (mode === 'replace' && !confirmed)) return
    setBackupBusy(true)
    setBackupError('')
    try {
      if (mode === 'merge') await flushProgress()
      await importBackup(pending.data, mode)
      if (mode === 'replace') {
        clearCheckpoints()
        clearPendingNoteDrafts()
        setGoal(String(pending.data.data.settings.weeklyGoal))
      }
      setPending(undefined)
      onNotify('Backup importado com sucesso.')
    } catch (failure) { setBackupError(getError(failure)) } finally { setBackupBusy(false) }
  }

  return (
    <>
      <PageHeading title="Configurações" description="Personalize o StudyOps, seu planejamento e seus backups." />
      <div className="preferences-grid">
        <section className="card preferences-card">
          <SectionTitle icon={Clock3} title="Planejamento de estudo" description="Organize sua semana e suas recomendações." />
          <form className="goal-form" onSubmit={(event) => {
            event.preventDefault()
            if (goal.trim()) void update({ weeklyGoal: Number(goal) }, 'Meta semanal atualizada.')
          }}>
            <label className="field">Meta semanal em horas<input type="number" required value={goal} onChange={(event) => setGoal(event.target.value)} min="0" max="168" step="any" /></label>
            <button className="button button-secondary" type="submit">Salvar meta</button>
          </form>
          <fieldset className="preferences-days">
            <legend>Dias disponíveis</legend>
            <div>
              {days.map(([day, label]) => {
                const selected = settings.availableDays.includes(day)
                return <button key={day} type="button" aria-pressed={selected} className="button button-secondary" onClick={() => void update({ availableDays: selected ? settings.availableDays.filter((value) => value !== day) : [...settings.availableDays, day] })}>{label}</button>
              })}
            </div>
          </fieldset>
          <label className="field">Duração padrão das sessões
            <select value={settings.defaultMinutes} onChange={(event) => void update({ defaultMinutes: Number(event.target.value) })}>
              {SESSION_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration} minutos</option>)}
            </select>
          </label>
          <label className="field">Adicionar prioridade na trilha
            <select value="" onChange={(event) => { if (event.target.value) void update({ priorityIds: [...settings.priorityIds, event.target.value] }) }}>
              <option value="">{activePriorities.length ? 'Selecionar item' : 'Seguir ordem da trilha'}</option>
              {priorities.filter((node) => !settings.priorityIds.includes(node.id)).map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
            </select>
            <small>O StudyOps considera a prioridade após sessões interrompidas e revisões vencidas.</small>
          </label>
          {!!activePriorities.length && (
            <ol className="preference-priorities" aria-label="Prioridades na ordem de estudo">
              {activePriorities.map(({ id, title }, index) => (
                <li key={id}>
                  <span>{title}</span>
                  <button className="icon-button" aria-label={`Subir ${title}`} disabled={index === 0} onClick={() => movePriority(index, -1)}><ChevronUp size={16} /></button>
                  <button className="icon-button" aria-label={`Descer ${title}`} disabled={index === activePriorities.length - 1} onClick={() => movePriority(index, 1)}><ChevronDown size={16} /></button>
                  <button className="icon-button" aria-label={`Remover prioridade de ${title}`} onClick={() => void update({ priorityIds: settings.priorityIds.filter((value) => value !== id) })}><X size={16} /></button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="card preferences-card">
          <SectionTitle icon={Monitor} title="Aparência e avisos" description="Ajuste o ambiente para as suas sessões." />
          <label className="field">Tema
            <select value={settings.theme} onChange={(event) => void update({ theme: event.target.value as Settings['theme'] })}>
              <option value="system">Tema do sistema</option><option value="light">Claro</option><option value="dark">Escuro</option>
            </select>
          </label>
          <label className="preference-toggle">
            <span><Bell size={16} /><span><strong>Avisar ao atingir o tempo planejado</strong><small>O aviso aparece no app e no sistema, quando permitido.</small></span></span>
            <input type="checkbox" role="switch" checked={settings.notifications} onChange={(event) => void configureNotifications(event.target.checked)} />
          </label>
          <label className="preference-toggle">
            <span><span><strong>Atalhos de teclado</strong><small><kbd>Ctrl</kbd> + <kbd>K</kbd> para buscar. <kbd>Alt</kbd> + <kbd>P</kbd> para pausar.</small></span></span>
            <input type="checkbox" role="switch" checked={settings.shortcuts} onChange={(event) => void update({ shortcuts: event.target.checked })} />
          </label>
          {error && <p className="error-text" role="alert">{error}</p>}
        </section>

        <section className="card preferences-card preferences-data">
          <SectionTitle icon={Database} title="Seus dados" description="Exporte, mescle ou restaure seu currículo, histórico e anotações em JSON." />
          <div className="preferences-backup-actions">
            <button className="button button-primary" disabled={backupBusy} onClick={() => void download()}><Download size={16} />Exportar backup</button>
            <button className="button button-secondary" disabled={backupBusy || activeTimer} onClick={() => fileInput.current?.click()}><Upload size={16} />Importar backup</button>
            <input type="file" hidden ref={fileInput} accept=".json,application/json" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = '' }} />
          </div>
          {activeTimer && <p className="muted">Pause ou finalize a sessão para importar um backup.</p>}
          {backupError && !pending && <p className="error-text" role="alert">{backupError}</p>}
          <div className="preferences-privacy"><ShieldCheck size={19} /><p>O StudyOps armazena seus dados neste navegador. Evite registrar credenciais, dados corporativos ou informações de chamados reais.</p></div>
        </section>
      </div>

      {pending && <Modal title="Importar backup" onClose={() => { if (!backupBusy) setPending(undefined) }}>
        <div className="backup-dialog">
          <p>Arquivo selecionado <strong>{pending.name}</strong></p>
          <label className="field">Como você quer importar?
            <select value={mode} disabled={backupBusy} onChange={(event) => { setMode(event.target.value as ImportMode); setConfirmed(false) }}>
              <option value="merge">Mesclar dados</option><option value="replace">Substituir dados</option>
            </select>
          </label>
          {mode === 'merge' ? <p>A mesclagem preserva suas configurações, seus materiais e os títulos da trilha quando os IDs coincidem. O progresso mais avançado e os registros mais recentes têm prioridade.</p> :
            <label className="finish-checkbox"><input type="checkbox" checked={confirmed} disabled={backupBusy} onChange={(event) => setConfirmed(event.target.checked)} />Confirmo a substituição de todos os dados locais por este backup.</label>}
          {backupError && <p className="error-text" role="alert">{backupError}</p>}
        </div>
        <div className="modal-actions">
          <button className="button button-secondary" disabled={backupBusy} onClick={() => setPending(undefined)}>Cancelar</button>
          <button className={`button ${mode === 'replace' ? 'button-danger' : 'button-primary'}`} disabled={backupBusy || activeTimer || (mode === 'replace' && !confirmed)} onClick={() => void restore()}>{backupBusy ? 'Importando…' : 'Confirmar importação'}</button>
        </div>
      </Modal>}
    </>
  )
}
