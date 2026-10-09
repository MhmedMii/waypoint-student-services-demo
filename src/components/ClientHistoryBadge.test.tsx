import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { ClientHistoryBadge } from './ClientHistoryBadge'

// لوحة سجل العميل نافذة منبثقة — لازم تنعلن كنافذة وتسكّر بـ Escape
describe('ClientHistoryBadge panel', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens as a dialog named by its title, closes on Escape, and returns focus to the badge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    render(
      <LanguageProvider>
        <ClientHistoryBadge phone="50000003" count={3} />
      </LanguageProvider>
    )
    const badge = screen.getByRole('button', { name: '3 visits' })
    badge.focus()
    fireEvent.click(badge)

    const dialog = await screen.findByRole('dialog', { name: 'Visit history — 50000003' })
    expect(dialog).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(badge).toHaveFocus()
  })
})
