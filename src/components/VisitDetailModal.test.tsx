import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { VisitDetailModal, type VisitDetailRow } from './VisitDetailModal'

function visit(overrides: Partial<VisitDetailRow> = {}): VisitDetailRow {
  return {
    id: 'v1',
    type: 'visa',
    name: 'DEMO STUDENT',
    phone: '98721391',
    desiredCountry: null,
    status: 'closed',
    studentStatus: 'closed',
    createdAt: '2026-08-31T09:50:00Z',
    pickedUpAt: '2026-08-31T09:56:52Z',
    closedAt: '2026-08-31T09:56:55Z',
    note: null,
    followUpDueAt: null,
    ...overrides,
  }
}

function renderModal(row: VisitDetailRow, onStatusChange?: any, onClose = vi.fn()) {
  render(
    <LanguageProvider>
      <VisitDetailModal visit={row} onClose={onClose} onStatusChange={onStatusChange} />
    </LanguageProvider>
  )
  return { onClose }
}

const optionLabels = () =>
  within(screen.getByRole('combobox'))
    .getAllByRole('option')
    .map((o) => o.textContent)

describe('VisitDetailModal status editor', () => {
  it('offers only Closed and Follow-up needed on a closed visit', () => {
    renderModal(visit(), vi.fn())
    expect(optionLabels()).toEqual(['Closed', 'Follow-up needed'])
    expect(screen.queryByText('In Session')).not.toBeInTheDocument()
    expect(screen.queryByText('Waiting')).not.toBeInTheDocument()
  })

  it('shows no editor on an open visit, just the current status and why', () => {
    renderModal(visit({ status: 'next', studentStatus: 'in_session', closedAt: null }), vi.fn())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByText('In Session')).toBeInTheDocument()
    expect(screen.getByText(/still open/i)).toBeInTheDocument()
  })

  it('shows no editor and no hint when the modal is read-only (no handler)', () => {
    renderModal(visit())
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByText(/still open/i)).not.toBeInTheDocument()
  })

  it('asks for a due date when Follow-up needed is chosen and blocks saving without one', () => {
    renderModal(visit(), vi.fn())
    expect(screen.queryByLabelText('Follow-up due')).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'follow_up_needed' } })
    const due = screen.getByLabelText('Follow-up due')
    expect((due as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    fireEvent.change(due, { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('sends the chosen status and due date, then closes', async () => {
    const onStatusChange = vi.fn().mockResolvedValue(null)
    const { onClose } = renderModal(visit(), onStatusChange)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'follow_up_needed' } })
    fireEvent.change(screen.getByLabelText('Follow-up due'), { target: { value: '2026-09-25' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onStatusChange).toHaveBeenCalledWith('follow_up_needed', '2026-09-25')
  })

  it('sends no due date for Closed', async () => {
    const onStatusChange = vi.fn().mockResolvedValue(null)
    renderModal(
      visit({ studentStatus: 'follow_up_needed', followUpDueAt: '2026-09-25T00:00:00Z' }),
      onStatusChange
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'closed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith('closed', null))
  })

  it('starts from the saved follow-up date', () => {
    renderModal(
      visit({ studentStatus: 'follow_up_needed', followUpDueAt: '2026-09-25T00:00:00Z' }),
      vi.fn()
    )
    expect(screen.getByRole('combobox')).toHaveValue('follow_up_needed')
    expect(screen.getByLabelText('Follow-up due')).toHaveValue('2026-09-25')
  })

  it('keeps the window open and shows the reason when the server refuses', async () => {
    const onStatusChange = vi.fn().mockResolvedValue('studentStatusNotAllowedForVisit')
    const { onClose } = renderModal(visit(), onStatusChange)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/cannot be set on this visit/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
  })

  it('falls back to a generic message for an unknown error code', async () => {
    renderModal(visit(), vi.fn().mockResolvedValue('couldNotSaveStatus'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(
      await screen.findByText('Could not save the status. Please try again.')
    ).toBeInTheDocument()
  })
})

describe('VisitDetailModal as a dialog', () => {
  it('is announced as a dialog named after the client, with focus inside', () => {
    renderModal(visit({ name: 'Fictional Student P' }))
    expect(screen.getByRole('dialog', { name: 'Fictional Student P' })).toHaveFocus()
  })

  it('closes on Escape, the same as its ✕', () => {
    const { onClose } = renderModal(visit())
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
