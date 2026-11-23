// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../src/domain/seed'
import type { Session } from '../src/domain/types'
import StatisticsPage from '../src/features/statistics/StatisticsPage'

afterEach(cleanup)

it('reparte o tempo na virada do mês e filtra o histórico pela data selecionada', async () => {
  const now = new Date(2026, 10, 22, 17).getTime()
  vi.spyOn(Date, 'now').mockReturnValue(now)
  const startedAt = new Date(2026, 9, 31, 23, 55).getTime()
  const firstPause = new Date(2026, 10, 1, 0, 5).getTime()
  const resumedAt = new Date(2026, 10, 22, 15).getTime()
  const endedAt = new Date(2026, 10, 22, 15, 6).getTime()
  const session: Session = {
    id: 's1', nodeId: 't1', title: 'Estudar endereçamento', plannedMinutes: 20,
    elapsedMs: 16 * 60_000, status: 'completed', startedAt, updatedAt: endedAt, endedAt, checkpoint: '',
    segments: [{ start: startedAt, end: firstPause }, { start: resumedAt, end: endedAt }],
  }
  const onOpenSession = vi.fn()
  const user = userEvent.setup()
  render(<StatisticsPage sessions={[session]} nodes={[]} settings={DEFAULT_SETTINGS} onOpenSession={onOpenSession} />)

  const summary = screen.getByRole('heading', { name: 'Este mês' }).closest('section')!
  expect(within(summary).getByText('11 min')).toBeDefined()
  const history = within(screen.getByRole('region', { name: 'Histórico de estudos' }))
  expect(history.getAllByRole('listitem')).toHaveLength(1)
  expect(history.getByText(/11 min/)).toBeDefined()

  await user.click(screen.getByRole('button', { name: /1 de novembro de 2026, 5 min de estudo/ }))
  expect(history.getByText(/5 min/)).toBeDefined()
  await user.click(history.getByRole('button', { name: session.title }))
  expect(onOpenSession).toHaveBeenCalledWith(session.id)

  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
  expect(screen.getByRole('heading', { name: 'outubro de 2026' })).toBeDefined()
  expect(history.getByText(/5 min/)).toBeDefined()
})
