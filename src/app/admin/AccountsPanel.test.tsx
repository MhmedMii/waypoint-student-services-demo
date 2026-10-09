// src/app/admin/AccountsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { AccountsPanel } from './AccountsPanel'

function renderAccountsPanel() {
  const session = {
    user: {
      id: 'u1',
      name: 'Eng. Demo Maintainer',
      role: 'super_admin',
      email: 'tech@example.com',
    },
    expires: '2099-01-01',
  }
  return render(
    <SessionProvider session={session as any}>
      <LanguageProvider>
        <AccountsPanel />
      </LanguageProvider>
    </SessionProvider>
  )
}

function accountsList() {
  return [
    {
      id: 'sa1',
      name: 'Demo Counselor One',
      email: 'demoCounselorOne.admin@example.com',
      role: 'super_admin',
      active: true,
      shift: null,
      floor: null,
      note: null,
    },
    {
      id: 'a1',
      name: 'Fictional Student U',
      email: 'yasmin@example.com',
      role: 'admin',
      active: true,
      shift: null,
      floor: null,
      note: null,
    },
    {
      id: 'c1',
      name: 'Fictional Student K',
      email: 'nour@example.com',
      role: 'counselor',
      active: true,
      shift: 'day',
      floor: 'M1',
      note: null,
    },
  ]
}

describe('AccountsPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/admin/accounts' && (!options || options.method === undefined)) {
        return Promise.resolve({ json: async () => [] })
      }
      return Promise.resolve({
        json: async () => ({
          ok: true,
          user: {
            id: 'user-1',
            name: 'New Counselor',
            role: 'counselor',
            email: 'new.counselor@example.com',
            active: true,
          },
        }),
      })
    }) as any
  })

  it('submits the add-account form with name, email, role, and a generated password', async () => {
    renderAccountsPanel()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/accounts'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Counselor' } })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new.counselor@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'counselor' } })
    fireEvent.click(screen.getByText('Add account'))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/accounts',
        expect.objectContaining({ method: 'POST' })
      )
    )

    const postCall = (global.fetch as any).mock.calls.find(
      (call: any[]) => call[1]?.method === 'POST'
    )
    const body = JSON.parse(postCall[1].body)
    expect(body.name).toBe('New Counselor')
    expect(body.email).toBe('new.counselor@example.com')
    expect(body.role).toBe('counselor')
    expect(typeof body.password).toBe('string')
    expect(body.password.length).toBeGreaterThan(0)
    expect(Array.isArray(body.scopes)).toBe(true)
  })

  it('shows the temporary password once after a successful submission', async () => {
    renderAccountsPanel()
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/admin/accounts'))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Counselor' } })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new.counselor@example.com' },
    })
    fireEvent.click(screen.getByText('Add account'))

    await waitFor(() => expect(screen.getByText(/Temporary password/i)).toBeInTheDocument())
  })

  it('splits accounts into three sections by role', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/accounts')
        return Promise.resolve({ json: async () => accountsList() })
      return Promise.resolve({ json: async () => ({ ok: true }) })
    }) as any

    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(screen.getByText('Super Admins')).toBeInTheDocument()
    expect(screen.getByText('Admins')).toBeInTheDocument()
    expect(screen.getByText('Counselors')).toBeInTheDocument()
    expect(screen.getByText('Fictional Student U')).toBeInTheDocument()
    expect(screen.getByText('Fictional Student K')).toBeInTheDocument()
  })

  it('opens a per-role actions menu from the kebab button, with promote only for admins', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/admin/accounts')
        return Promise.resolve({ json: async () => accountsList() })
      return Promise.resolve({ json: async () => ({ ok: true }) })
    }) as any

    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student U')).toBeInTheDocument())

    fireEvent.click(screen.getAllByLabelText('More actions')[1]) // Yasmin's row (admin)
    expect(screen.getByText('Actions for Fictional Student U')).toBeInTheDocument()
    expect(screen.getByText('Promote to Super Admin')).toBeInTheDocument()
    expect(screen.queryByText('Edit shift & scopes')).not.toBeInTheDocument()
  })

  it('opens the unified edit modal for a counselor and saves shift, note, and scopes together', async () => {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/admin/accounts')
        return Promise.resolve({ json: async () => accountsList() })
      if (url === '/api/admin/accounts/c1' && (!options || !options.method))
        return Promise.resolve({ json: async () => ({ scopes: ['USA'] }) })
      return Promise.resolve({ json: async () => ({ ok: true }) })
    }) as any

    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student K')).toBeInTheDocument())

    fireEvent.click(screen.getAllByLabelText('More actions')[2]) // Nour's row (counselor)
    fireEvent.click(screen.getByText('Edit shift & scopes'))
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      const patchCalls = (global.fetch as any).mock.calls.filter(
        (call: any[]) => call[0] === '/api/admin/accounts/c1' && call[1]?.method === 'PATCH'
      )
      const actions = patchCalls.map((call: any[]) => JSON.parse(call[1].body).action)
      expect(actions).toContain('updateShift')
      expect(actions).toContain('updateNote')
      expect(actions).toContain('updateScopes')
    })
  })
})

describe('AccountsPanel: scopes, last seen, and inactive accounts', () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86400000).toISOString()

  function counselor(overrides: Record<string, unknown> = {}) {
    return {
      id: 'c1',
      name: 'Sample Counselor One',
      email: 'one@example.com',
      role: 'counselor',
      active: true,
      shift: 'day',
      floor: 'M3',
      note: null,
      scopes: ['USA', 'GCC', 'visa_services'],
      lastSeenAt: daysAgo(0),
      ...overrides,
    }
  }

  function mockAccounts(rows: unknown[]) {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/admin/accounts') return { ok: true, json: async () => rows } as any
      return { ok: true, json: async () => ({ ok: true }) } as any
    }) as any
  }

  const rowOf = (name: string) => screen.getByText(name, { exact: false }).closest('tr')!

  it('shows a scope count, with the names on hover', async () => {
    mockAccounts([counselor()])
    renderAccountsPanel()
    await screen.findByText('Sample Counselor One', { exact: false })

    const count = screen.getByText('3 scopes')
    expect(count).toBeInTheDocument()
    expect(count).toHaveAttribute('title', expect.stringContaining('Visa services'))
    expect(count.getAttribute('title')).toContain('USA')
  })

  // الحالة اللي تفسّر "صفر عملاء" — ما كانت تبين بأي صفحة
  it('marks a counselor with no scopes, and says why it matters', async () => {
    mockAccounts([counselor({ scopes: [] })])
    renderAccountsPanel()

    const none = await screen.findByText('No scopes')
    expect(none).toHaveClass('none')
    expect(none.getAttribute('title')).toContain('never be routed a client')
  })

  it('shows when each person was last seen, flagging a long absence', async () => {
    mockAccounts([
      counselor({ id: 'c1', name: 'Sample Recent', lastSeenAt: daysAgo(0) }),
      counselor({ id: 'c2', name: 'Sample Absent', lastSeenAt: daysAgo(19) }),
    ])
    renderAccountsPanel()
    await screen.findByText('Sample Absent', { exact: false })

    expect(screen.getByText('Today')).not.toHaveClass('stale')
    expect(screen.getByText('19 days ago')).toHaveClass('stale')
  })

  it('sinks inactive accounts below the active ones and dims them', async () => {
    mockAccounts([
      counselor({ id: 'c1', name: 'Sample Inactive', active: false }),
      counselor({ id: 'c2', name: 'Sample Active', active: true }),
    ])
    renderAccountsPanel()
    await screen.findByText('Sample Inactive', { exact: false })

    const names = screen
      .getAllByRole('row')
      .map((r) => r.textContent ?? '')
      .filter((text) => text.includes('Sample'))
    expect(names[0]).toContain('Sample Active')
    expect(names[1]).toContain('Sample Inactive')
    expect(rowOf('Sample Inactive')).toHaveClass('account-inactive')
    expect(rowOf('Sample Active')).not.toHaveClass('account-inactive')
  })
})

describe('AccountsPanel pop-ups as dialogs', () => {
  function mockAccounts() {
    global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
      if (url === '/api/admin/accounts')
        return Promise.resolve({ json: async () => accountsList() })
      if (url === '/api/admin/accounts/c1' && (!options || !options.method))
        return Promise.resolve({ json: async () => ({ scopes: ['USA'] }) })
      return Promise.resolve({ json: async () => ({ ok: true }) })
    }) as any
  }

  it('announces the actions menu as a dialog, closes it on Escape, and returns focus to ⋯', async () => {
    mockAccounts()
    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student U')).toBeInTheDocument())
    const kebab = screen.getAllByLabelText('More actions')[1]
    kebab.focus()
    fireEvent.click(kebab)

    expect(screen.getByRole('dialog', { name: 'Actions for Fictional Student U' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(kebab).toHaveFocus()
  })

  it('announces the Arabic-name editor as a dialog and closes it on Escape', async () => {
    mockAccounts()
    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student U')).toBeInTheDocument())
    const kebab = screen.getAllByLabelText('More actions')[1]
    kebab.focus()
    fireEvent.click(kebab)
    fireEvent.click(screen.getByRole('button', { name: 'Edit Arabic name' }))

    expect(await screen.findByRole('dialog', { name: 'Fictional Student U' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(kebab).toHaveFocus()
  })

  it('announces the shift-and-scopes editor as a dialog and closes it on Escape', async () => {
    mockAccounts()
    renderAccountsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student K')).toBeInTheDocument())
    fireEvent.click(screen.getAllByLabelText('More actions')[2])
    fireEvent.click(screen.getByRole('button', { name: 'Edit shift & scopes' }))

    expect(await screen.findByRole('dialog', { name: 'Fictional Student K' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
