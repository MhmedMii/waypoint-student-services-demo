import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { OnlineNowPanel } from './OnlineNowPanel'

function mockPresence(rows: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rows }))
}

function presenceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: 'Demo Counselor Five',
    nameAr: 'مستشار تجريبي خامس',
    role: 'counselor',
    isOnline: false,
    lastSeenAt: new Date(Date.now() - (14 * 60 + 39) * 1000).toISOString(),
    onlineSecondsToday: 14 * 60 + 39,
    ...overrides,
  }
}

afterEach(() => {
  document.cookie = 'app-language=; path=/; max-age=0'
})

describe('OnlineNowPanel', () => {
  it('shows the English name and English duration units by default', async () => {
    mockPresence([presenceRow()])
    render(
      <LanguageProvider>
        <OnlineNowPanel />
      </LanguageProvider>
    )
    expect(await screen.findByText('Demo Counselor Five')).toBeInTheDocument()
    expect(screen.getByText('DC')).toBeInTheDocument()
    expect(screen.getAllByText(/0h 14m 39s/).length).toBeGreaterThan(0)
  })

  it('shows the Arabic name, Arabic avatar initials, and Arabic duration units in Arabic mode', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockPresence([presenceRow()])
    render(
      <LanguageProvider>
        <OnlineNowPanel />
      </LanguageProvider>
    )
    expect(await screen.findByText('مستشار تجريبي خامس')).toBeInTheDocument()
    expect(screen.getByText('مت')).toBeInTheDocument()
    expect(screen.getAllByText(/0س 14د 39ث/).length).toBeGreaterThan(0)
  })

  it('formats "last seen" with the Arabic "منذ" phrasing for a counselor idle all day', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockPresence([
      presenceRow({
        onlineSecondsToday: 0,
        lastSeenAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
      }),
    ])
    render(
      <LanguageProvider>
        <OnlineNowPanel />
      </LanguageProvider>
    )
    expect(await screen.findByText(/منذ 4 أيام/)).toBeInTheDocument()
  })

  it('falls back to the English name when no Arabic name is stored', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockPresence([presenceRow({ nameAr: null })])
    render(
      <LanguageProvider>
        <OnlineNowPanel />
      </LanguageProvider>
    )
    expect(await screen.findByText('Demo Counselor Five')).toBeInTheDocument()
  })
})
