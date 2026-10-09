import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { ApplicationProfileModal } from './ApplicationProfileModal'
import type { ApplicationRow } from './ApplicationsPanel'

function application(): ApplicationRow {
  return {
    id: 'app-1',
    applicationNumber: 'UK-0001',
    kind: 'visa',
    name: 'Fictional Student H',
    phone: '50000009',
    serviceCode: 'uk-student',
    status: 'pending',
    statusNote: null,
    referenceNumber: null,
    counselorId: null,
    paymentUrl: null,
    acceptedAt: null,
    closedAt: null,
    fields: {},
    createdAt: '2026-09-20T09:00:00Z',
    updatedAt: '2026-09-20T09:00:00Z',
  }
}

describe('ApplicationProfileModal as a dialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function renderModal(onClose = vi.fn()) {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }))
    render(
      <LanguageProvider>
        <ApplicationProfileModal
          application={application()}
          counselors={[]}
          onClose={onClose}
          onUpdateStatus={vi.fn()}
          onReassign={vi.fn()}
          onPaymentUrlSaved={vi.fn()}
        />
      </LanguageProvider>
    )
    return onClose
  }

  it('is announced as a dialog named after the applicant, with focus inside', () => {
    renderModal()
    expect(screen.getByRole('dialog', { name: 'Fictional Student H' })).toHaveFocus()
  })

  it('closes on Escape, the same as its ✕', () => {
    const onClose = renderModal()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  // الـ✕ كان ينقرا "Cancel" هنا و"Close" بكل مكان ثاني — نفس الزر باسمين
  it('names its ✕ "Close", like every other pop-up', () => {
    const onClose = renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
