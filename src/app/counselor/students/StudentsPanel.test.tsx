import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '../../../i18n/LanguageContext'
import { StudentsPanel } from './StudentsPanel'

function visitRow(overrides: any = {}) {
  return {
    id: 'v1',
    type: 'new',
    name: 'Demo Student One',
    phone: '56012345',
    desiredCountry: 'US',
    status: 'next',
    studentStatus: 'waiting',
    createdAt: '2026-08-12T09:00:00Z',
    pickedUpAt: null,
    closedAt: null,
    note: null,
    ...overrides,
  }
}

function renderStudentsPanel() {
  return render(
    <SessionProvider session={null}>
      <LanguageProvider>
        <StudentsPanel />
      </LanguageProvider>
    </SessionProvider>
  )
}

describe('StudentsPanel status filter chips', () => {
  beforeEach(() => {
    const visits = [
      visitRow({ id: 'v1', name: 'Demo Student One', studentStatus: 'waiting' }),
      visitRow({ id: 'v2', name: 'Fictional Student G', studentStatus: 'in_session' }),
      visitRow({ id: 'v3', name: 'Fictional Student O', studentStatus: 'follow_up_needed' }),
    ]
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/students/visits')
        return Promise.resolve({ ok: true, json: async () => visits })
      return Promise.resolve({ ok: true, json: async () => [] })
    }) as any
  })

  it('shows all students by default with correct chip counts', async () => {
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())
    expect(screen.getByText('Fictional Student G')).toBeInTheDocument()
    expect(screen.getByText('Fictional Student O')).toBeInTheDocument()
    expect(screen.getByText(/All \(3\)/)).toBeInTheDocument()
    expect(screen.getByText(/Waiting \(1\)/)).toBeInTheDocument()
  })

  it('filters the visible cards when a status chip is clicked', async () => {
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())

    fireEvent.click(screen.getByText(/Waiting \(1\)/))

    expect(screen.getByText('Demo Student One')).toBeInTheDocument()
    expect(screen.queryByText('Fictional Student G')).not.toBeInTheDocument()
    expect(screen.queryByText('Fictional Student O')).not.toBeInTheDocument()
  })

  it('shows an empty-filter message when no student matches the chosen filter', async () => {
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())

    fireEvent.click(screen.getByText(/Closed \(0\)/))

    expect(screen.getByText('No students match this filter')).toBeInTheDocument()
  })
})

describe('StudentsPanel follow-up due badge', () => {
  function mockVisits(visits: unknown[]) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/students/visits')
        return Promise.resolve({ ok: true, json: async () => visits })
      return Promise.resolve({ ok: true, json: async () => [] })
    }) as any
  }

  it('shows an overdue badge when the due date has passed', async () => {
    mockVisits([
      visitRow({
        name: 'Fictional Student R',
        studentStatus: 'follow_up_needed',
        followUpDueAt: '2020-01-01T00:00:00Z',
      }),
    ])
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Fictional Student R')).toBeInTheDocument())
    expect(screen.getByText(/Overdue/)).toBeInTheDocument()
  })

  it('shows no due badge for a client who is just waiting', async () => {
    mockVisits([visitRow({ name: 'Demo Student One', studentStatus: 'waiting' })])
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument()
  })

  it('shows a future due date without flagging it as overdue', async () => {
    const farFuture = new Date(Date.now() + 20 * 86400000).toISOString()
    mockVisits([
      visitRow({
        name: 'Demo Counselor Eight',
        studentStatus: 'follow_up_needed',
        followUpDueAt: farFuture,
      }),
    ])
    renderStudentsPanel()
    await waitFor(() => expect(screen.getByText('Demo Counselor Eight')).toBeInTheDocument())
    expect(screen.getByText(/^Due /)).toBeInTheDocument()
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument()
  })
})
