// @vitest-environment jsdom
import { webcrypto } from 'node:crypto'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginGate from '../src/features/auth/LoginGate'

function AppWithGate() {
  return (
    <LoginGate>
      {signOut => <button onClick={signOut}>Sair do StudyOps</button>}
    </LoginGate>
  )
}

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Acesso ao StudyOps', () => {
  it('exibe o erro de credenciais e mantém o aplicativo fechado', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const user = userEvent.setup()
    render(<AppWithGate />)

    await user.type(screen.getByLabelText('Usuário'), 'outra-pessoa')
    await user.type(screen.getByLabelText('Senha'), 'senha-incorreta')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect((await screen.findByRole('alert')).textContent).toBe('Usuário ou senha incorretos.')
    expect(screen.queryByRole('button', { name: 'Sair do StudyOps' })).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('abre o aplicativo após uma validação bem-sucedida, restaura a aba e encerra a sessão', async () => {
    const validDigest = Buffer.from('dd04452228aabffee0d6ee6b1719424a4e77eeb435b4272a7efc75c4d36a57a0', 'hex')
    const digest = vi.fn().mockResolvedValue(Uint8Array.from(validDigest).buffer)
    vi.stubGlobal('crypto', { subtle: { digest } })
    const user = userEvent.setup()
    const view = render(<AppWithGate />)

    await user.type(screen.getByLabelText('Usuário'), 'usuario-de-teste')
    await user.type(screen.getByLabelText('Senha'), 'senha-de-teste')
    await user.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('text')
    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    expect(screen.getByLabelText('Senha').getAttribute('type')).toBe('password')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByRole('button', { name: 'Sair do StudyOps' })).toBeDefined()
    expect(digest).toHaveBeenCalledOnce()
    const [algorithm, data] = digest.mock.calls[0]
    expect(algorithm).toBe('SHA-256')
    expect(new TextDecoder().decode(data)).toBe('["usuario-de-teste","senha-de-teste"]')
    expect(sessionStorage.length).toBe(1)
    expect(sessionStorage.getItem(sessionStorage.key(0)!)).toBe('granted')

    view.unmount()
    render(<AppWithGate />)
    await user.click(screen.getByRole('button', { name: 'Sair do StudyOps' }))
    expect(screen.getByRole('heading', { name: 'Entre no StudyOps' })).toBeDefined()
    expect(sessionStorage.length).toBe(0)
  })
})
