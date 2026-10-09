import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { CounselorOnlineHistory } from './CounselorOnlineHistory'

function mockPresence(rows: unknown[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/sessions')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ok: true, totalSeconds: 0, sessions: [] }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => rows })
    })
  )
}

function counselor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: 'Demo Counselor Two',
    nameAr: 'مستشار تجريبي ثان',
    role: 'counselor',
    isOnline: true,
    lastSeenAt: null,
    onlineSecondsToday: 3600,
    ...overrides,
  }
}

describe('CounselorOnlineHistory', () => {
  it('renders counselors as a plain table, not cards', async () => {
    mockPresence([counselor()])
    render(
      <LanguageProvider>
        <CounselorOnlineHistory role="admin" />
      </LanguageProvider>
    )

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Demo Counselor Two')).toBeInTheDocument()
    expect(document.querySelector('.card-grid')).not.toBeInTheDocument()
    expect(document.querySelector('.counselor-card')).not.toBeInTheDocument()
  })

  it('shows the Arabic name instead of the Latin one in Arabic mode', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockPresence([counselor()])
    render(
      <LanguageProvider>
        <CounselorOnlineHistory role="admin" />
      </LanguageProvider>
    )

    expect(await screen.findByText('مستشار تجريبي ثان')).toBeInTheDocument()
    document.cookie = 'app-language=; path=/; max-age=0'
  })

  it('expands the session detail inline when a row is clicked, and closes it again', async () => {
    mockPresence([counselor()])
    render(
      <LanguageProvider>
        <CounselorOnlineHistory role="admin" />
      </LanguageProvider>
    )

    const row = await screen.findByText('Demo Counselor Two')
    fireEvent.click(row)
    expect(await screen.findByText('Demo Counselor Two', { selector: 'h3' })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByText('Demo Counselor Two', { selector: 'h3' })).not.toBeInTheDocument()
  })

  it('hides the admins section from a plain admin, shows it for super_admin', async () => {
    mockPresence([
      counselor(),
      counselor({ id: 'u2', name: 'Demo Maintainer', nameAr: null, role: 'super_admin' }),
    ])
    render(
      <LanguageProvider>
        <CounselorOnlineHistory role="admin" />
      </LanguageProvider>
    )
    await screen.findByText('Demo Counselor Two')
    expect(screen.queryByText('Demo Maintainer')).not.toBeInTheDocument()
  })
})

describe('CounselorOnlineHistory from the keyboard', () => {
  function renderHistory() {
    mockPresence([counselor()])
    render(
      <LanguageProvider>
        <CounselorOnlineHistory role="admin" />
      </LanguageProvider>
    )
  }

  it('makes the name a real button that says whether the details are open', async () => {
    renderHistory()
    const name = await screen.findByRole('button', { name: 'Demo Counselor Two' })
    expect(name).toHaveAttribute('aria-expanded', 'false')
    expect(name.closest('tr')).not.toHaveAttribute('role')

    fireEvent.click(name)
    expect(name).toHaveAttribute('aria-expanded', 'true')
    const controlled = document.getElementById(name.getAttribute('aria-controls')!)
    expect(controlled).not.toBeNull()
    expect(
      within(controlled!).getByText('Demo Counselor Two', { selector: 'h3' })
    ).toBeInTheDocument()
  })

  it('opens on one press and closes on the next', async () => {
    renderHistory()
    const name = await screen.findByRole('button', { name: 'Demo Counselor Two' })
    fireEvent.click(name)
    expect(name).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(name)
    expect(name).toHaveAttribute('aria-expanded', 'false')
  })

  it('still opens when the mouse clicks elsewhere on the row', async () => {
    renderHistory()
    const name = await screen.findByRole('button', { name: 'Demo Counselor Two' })
    fireEvent.click(within(name.closest('tr')!).getByText('Online'))
    expect(name).toHaveAttribute('aria-expanded', 'true')
  })
})
