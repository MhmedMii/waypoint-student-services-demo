import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { WalkInVisaPanel } from './WalkInVisaPanel'
import { ApplicationsPanel } from './ApplicationsPanel'

function visaVisits(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    counselorId: null,
    id: `v${i + 1}`,
    type: 'visa',
    name: `Sample Client ${String(i + 1).padStart(3, '0')}`,
    phone: `5000${String(i + 1).padStart(4, '0')}`,
    desiredCountry: null,
    status: 'closed',
    studentStatus: 'closed',
    createdAt: '2026-09-01T09:00:00Z',
    pickedUpAt: '2026-09-01T09:05:00Z',
    closedAt: '2026-09-01T09:20:00Z',
    note: null,
  }))
}

function applications(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `a${i + 1}`,
    applicationNumber: `VISA-${String(i + 1).padStart(4, '0')}`,
    kind: 'visa',
    name: `Sample Applicant ${String(i + 1).padStart(3, '0')}`,
    phone: `5100${String(i + 1).padStart(4, '0')}`,
    serviceCode: 'uk-student',
    status: 'pending',
    statusNote: null,
    referenceNumber: null,
    counselorId: null,
    paymentUrl: null,
    acceptedAt: null,
    closedAt: null,
    fields: {},
    missingDocuments: [],
    requiredDocumentCount: 0,
    uploadedRequiredCount: 0,
    createdAt: '2026-09-01T09:00:00Z',
    updatedAt: '2026-09-01T09:00:00Z',
  }))
}

function mockFetch(routes: Record<string, unknown>) {
  global.fetch = vi.fn(async (url: string) => {
    for (const [prefix, body] of Object.entries(routes)) {
      if (typeof url === 'string' && url.startsWith(prefix)) {
        return { ok: true, json: async () => body } as any
      }
    }
    return { ok: true, json: async () => [] } as any
  }) as any
}

const renderWith = (ui: React.ReactElement) =>
  render(
    <SessionProvider session={null}>
      <LanguageProvider>{ui}</LanguageProvider>
    </SessionProvider>
  )

const bodyRows = () => screen.getAllByRole('row').slice(1)
const pager = () => screen.queryByRole('navigation', { name: 'Pages' })

beforeEach(() => {
  localStorage.clear()
})

describe('Walk-in Visa table paging', () => {
  it('shows 20 rows of 45 and its own page buttons', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(45) })
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    expect(bodyRows()).toHaveLength(20)
    expect(screen.getByText('Showing 1–20 of 45')).toBeInTheDocument()
    expect(within(pager()!).getByRole('button', { name: 'Page 3' })).toBeInTheDocument()
  })

  it('moves to the next page and back', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(45) })
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(screen.getByText('Showing 21–40 of 45')).toBeInTheDocument()
    expect(screen.queryByText('Sample Client 001')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '‹ Prev' }))
    expect(screen.getByText('Sample Client 001')).toBeInTheDocument()
  })

  it('changes rows per page and remembers it under its own key', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(45) })
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(bodyRows()).toHaveLength(10)
    expect(localStorage.getItem('walk-in-visa-page-size')).toBe('10')
    // مفتاح مستقل — ما يلمس اختيار صفحة الزيارات
    expect(localStorage.getItem('visits-page-size')).toBeNull()
  })

  it('hides the page buttons when everything fits, which is today with a handful of rows', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(3) })
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    expect(bodyRows()).toHaveLength(3)
    expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()
    expect(pager()).not.toBeInTheDocument()
  })
})

describe('Applications table paging', () => {
  it('pages the applications table independently of the walk-in table', async () => {
    mockFetch({
      '/api/applications/kind/visa': applications(30),
      '/api/counselors/active': [],
    })
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')

    expect(screen.getByText('Showing 1–20 of 30')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '50' }))
    await waitFor(() => expect(screen.getByText('Showing 1–30 of 30')).toBeInTheDocument())
    expect(localStorage.getItem('applications-visa-page-size')).toBe('50')
    expect(localStorage.getItem('walk-in-visa-page-size')).toBeNull()
  })

  it('keeps exam applications on their own stored page size', async () => {
    mockFetch({ '/api/applications/kind/exam': applications(30), '/api/counselors/active': [] })
    renderWith(<ApplicationsPanel kind="exam" />)
    await screen.findByText('VISA-0001')

    fireEvent.click(screen.getByRole('button', { name: '10' }))
    expect(localStorage.getItem('applications-exam-page-size')).toBe('10')
    expect(localStorage.getItem('applications-visa-page-size')).toBeNull()
  })

  it('shows every record across pages — paging hides nothing', async () => {
    mockFetch({ '/api/applications/kind/visa': applications(25), '/api/counselors/active': [] })
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')

    expect(screen.queryByText('VISA-0025')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
    expect(screen.getByText('VISA-0025')).toBeInTheDocument()
    expect(screen.getByText('Showing 21–25 of 25')).toBeInTheDocument()
  })
})

describe('Walk-in visa table: counselor column', () => {
  const counselors = [
    { id: 'c1', name: 'Sample Counselor One', nameAr: null },
    { id: 'c2', name: 'Sample Counselor Two', nameAr: null },
  ]

  function mockWalkIn(visits: unknown[]) {
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/counselors/active') return { ok: true, json: async () => counselors } as any
      if (url === '/api/admin/reassign')
        return { ok: true, json: async () => ({ ok: true }), init } as any
      if (url.startsWith('/api/visits/type/visa'))
        return { ok: true, json: async () => visits } as any
      return { ok: true, json: async () => [] } as any
    }) as any
  }

  const cellsOf = (name: string) =>
    Array.from(screen.getByText(name).closest('tr')!.querySelectorAll('td'))

  it('puts Counselor between Student status and Timeline', async () => {
    mockWalkIn(visaVisits(1))
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    const headers = Array.from(screen.getAllByRole('columnheader')).map((h) => h.textContent)
    expect(headers).toEqual(['Name', 'Phone', 'Status', 'Student status', 'Counselor', 'Timeline'])
  })

  it('offers the dropdown on an unassigned row, listing the active counselors', async () => {
    mockWalkIn(visaVisits(1))
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    const options = Array.from(screen.getByRole('combobox').querySelectorAll('option')).map(
      (o) => o.textContent
    )
    expect(options).toEqual(['Choose counselor…', 'Sample Counselor One', 'Sample Counselor Two'])
  })

  it('shows the name and an unassign button on an assigned row', async () => {
    mockWalkIn([{ ...visaVisits(1)[0], counselorId: 'c1', counselorName: 'Sample Counselor One' }])
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    expect(screen.getByText('Sample Counselor One')).toBeInTheDocument()
    // الاسم يقول وش يسوي الزر ولمين — مو الرمز ✕ (قارئ الشاشة كان يقول "multiplication x")
    expect(
      screen.getByRole('button', { name: 'Unassign Sample Counselor One' })
    ).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('assigns through the same endpoint the Visits page uses', async () => {
    mockWalkIn(visaVisits(1))
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'c2' } })

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reassign',
        expect.objectContaining({ body: JSON.stringify({ visitId: 'v1', counselorId: 'c2' }) })
      )
    )
  })

  it('gives a counselor no controls, but still names the state', async () => {
    mockWalkIn([
      visaVisits(2)[0],
      { ...visaVisits(2)[1], counselorId: 'c1', counselorName: 'Sample Counselor One' },
    ])
    renderWith(<WalkInVisaPanel role="counselor" />)
    await screen.findByText('Sample Client 001')

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    // بالاسم الحقيقي — بحث عن "✕" صار ما يلقى شي حتى لو الزر ظاهر، فيعدّي على الفاضي
    expect(screen.queryByRole('button', { name: /^Unassign / })).not.toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
    expect(screen.getByText('Sample Counselor One')).toBeInTheDocument()
  })

  it('never shows a raw id, even for a counselor missing from the active list', async () => {
    // مستشار تجريبي ثامن مثلاً: مُعيَّن، بس خارج دوامه الحين فما يجي بقائمة النشطين.
    // قبل هالإصلاح كانت الخانة تعرض المعرّف الخام مكان الاسم
    mockWalkIn([
      {
        ...visaVisits(1)[0],
        counselorId: 'fdb6dea0-52ed-47f5-8b77-6489ae0d22b2',
        counselorName: 'Off Shift Counselor',
        counselorNameAr: null,
      },
    ])
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    expect(screen.getByText('Off Shift Counselor')).toBeInTheDocument()
    expect(screen.queryByText(/fdb6dea0/)).not.toBeInTheDocument()
    // الاسم ما يعتمد على الدروب داون: النشطون هنا ما فيهم هالمستشار
    expect(counselors.some((c) => c.id === 'fdb6dea0-52ed-47f5-8b77-6489ae0d22b2')).toBe(false)
  })

  it('falls back to Unassigned rather than an id when the name cannot be resolved', async () => {
    mockWalkIn([{ ...visaVisits(1)[0], counselorId: 'ghost-id', counselorName: null }])
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    expect(screen.queryByText('ghost-id')).not.toBeInTheDocument()
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows a date on every timeline step, not just a word', async () => {
    mockWalkIn([
      {
        ...visaVisits(1)[0],
        status: 'next',
        studentStatus: 'waiting',
        createdAt: '2026-09-13T09:20:00Z',
        pickedUpAt: null,
        closedAt: null,
      },
    ])
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    const timeline = cellsOf('Sample Client 001').at(-1)!
    expect(timeline).toHaveTextContent('Submitted')
    expect(timeline.textContent).toMatch(/Sep 13/)
    // انتظار طويل يبان بالصف نفسه: أُرسلت بتاريخ، وما انستلمت
    expect(timeline).toHaveTextContent('Picked up')
    expect(timeline).toHaveTextContent('not yet')
  })

  it('counts the true range, not the page size', async () => {
    mockWalkIn(visaVisits(16))
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')
    expect(screen.getByText('Showing 1–16 of 16')).toBeInTheDocument()
  })
})

describe('Search on the visa and exam tables', () => {
  function mockApplications(rows: unknown[]) {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/counselors/active') return { ok: true, json: async () => [] } as any
      if (url.startsWith('/api/applications/kind/'))
        return { ok: true, json: async () => rows } as any
      return { ok: true, json: async () => [] } as any
    }) as any
  }

  it('filters the applications table by name, phone or application number', async () => {
    mockApplications(applications(3))
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'VISA-0002' } })

    expect(screen.getByText('VISA-0002')).toBeInTheDocument()
    expect(screen.queryByText('VISA-0001')).not.toBeInTheDocument()
    expect(screen.getByText('1 of 3 match “VISA-0002”')).toBeInTheDocument()
  })

  it('finds an Arabic name however it was spelled', async () => {
    mockApplications([{ ...applications(1)[0], name: 'أمل هارت' }])
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('أمل هارت')

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'امل' } })
    expect(screen.getByText('أمل هارت')).toBeInTheDocument()
  })

  it('says so when nothing matches, and clearing brings everything back', async () => {
    mockApplications(applications(3))
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches “zzz”.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(screen.getByText('VISA-0001')).toBeInTheDocument()
    expect(screen.getByText('Showing 1–3 of 3')).toBeInTheDocument()
  })

  it('searches the walk-in table too', async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/counselors/active') return { ok: true, json: async () => [] } as any
      if (url.startsWith('/api/visits/type/visa'))
        return { ok: true, json: async () => visaVisits(4) } as any
      return { ok: true, json: async () => [] } as any
    }) as any
    renderWith(<WalkInVisaPanel role="super_admin" />)
    await screen.findByText('Sample Client 001')

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '50000003' } })
    expect(screen.getByText('Sample Client 003')).toBeInTheDocument()
    expect(screen.queryByText('Sample Client 001')).not.toBeInTheDocument()
  })
})

describe('Turnaround reads in days once it passes two days', () => {
  function mockApps(rows: unknown[]) {
    global.fetch = vi.fn(async (url: string) => {
      if (url === '/api/counselors/active') return { ok: true, json: async () => [] } as any
      if (url.startsWith('/api/applications/kind/'))
        return { ok: true, json: async () => rows } as any
      return { ok: true, json: async () => [] } as any
    }) as any
  }

  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

  it('keeps hours for something opened six hours ago', async () => {
    mockApps([{ ...applications(1)[0], createdAt: hoursAgo(6) }])
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')
    expect(screen.getByText(/In progress · 6h/)).toBeInTheDocument()
  })

  it('reads 645 hours as 27 days, which nobody should have to work out', async () => {
    mockApps([{ ...applications(1)[0], createdAt: hoursAgo(645) }])
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')
    expect(screen.getByText(/In progress · 27d/)).toBeInTheDocument()
    expect(screen.queryByText(/645h/)).not.toBeInTheDocument()
  })

  it('still reports a closed application in days when it took that long', async () => {
    mockApps([
      {
        ...applications(1)[0],
        status: 'approved',
        createdAt: hoursAgo(788),
        updatedAt: new Date().toISOString(),
      },
    ])
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')
    expect(screen.getByText(/33d/)).toBeInTheDocument()
  })
})

// الصف كان ينفتح بالماوس بس. الحل زر حقيقي على الاسم — مو role="button" على
// الـ<tr>، اللي كان يخلي قارئ الشاشة يقرا الصف كله كزر ويضيّع الأعمدة
describe('Opening a row from the keyboard', () => {
  const rowOf = (el: HTMLElement) => el.closest('tr') as HTMLTableRowElement

  it('gives each walk-in row a real button on the name, and the row stays a row', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(1), '/api/counselors/active': [] })
    renderWith(<WalkInVisaPanel role="admin" />)
    const name = await screen.findByRole('button', { name: 'Sample Client 001' })

    expect(name.tagName).toBe('BUTTON')
    expect(name).toHaveAttribute('aria-haspopup', 'dialog')
    expect(rowOf(name)).not.toHaveAttribute('role')
    expect(screen.getAllByRole('row')).toContain(rowOf(name))
  })

  it('opens the walk-in details from the name, and Escape returns focus to it', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(1), '/api/counselors/active': [] })
    renderWith(<WalkInVisaPanel role="admin" />)
    const name = await screen.findByRole('button', { name: 'Sample Client 001' })
    name.focus()
    fireEvent.click(name)

    expect(screen.getByRole('dialog', { name: 'Sample Client 001' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(name).toHaveFocus()
  })

  it('still opens the walk-in details when the mouse clicks elsewhere on the row', async () => {
    mockFetch({ '/api/visits/type/visa': visaVisits(1), '/api/counselors/active': [] })
    renderWith(<WalkInVisaPanel role="admin" />)
    await screen.findByText('Sample Client 001')

    fireEvent.click(screen.getByText('50000001'))
    expect(screen.getByRole('dialog', { name: 'Sample Client 001' })).toBeInTheDocument()
  })

  it('gives each application row a real button on the name, and the row stays a row', async () => {
    mockFetch({ '/api/applications/kind/visa': applications(1), '/api/counselors/active': [] })
    renderWith(<ApplicationsPanel kind="visa" />)
    const name = await screen.findByRole('button', { name: 'Sample Applicant 001' })

    expect(name).toHaveAttribute('aria-haspopup', 'dialog')
    expect(rowOf(name)).not.toHaveAttribute('role')
    expect(screen.getAllByRole('row')).toContain(rowOf(name))
  })

  it('opens the application details from the name, and Escape returns focus to it', async () => {
    mockFetch({ '/api/applications/kind/visa': applications(1), '/api/counselors/active': [] })
    renderWith(<ApplicationsPanel kind="visa" />)
    const name = await screen.findByRole('button', { name: 'Sample Applicant 001' })
    name.focus()
    fireEvent.click(name)

    expect(screen.getByRole('dialog', { name: 'Sample Applicant 001' })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(name).toHaveFocus()
  })

  it('still opens the application details when the mouse clicks elsewhere on the row', async () => {
    mockFetch({ '/api/applications/kind/visa': applications(1), '/api/counselors/active': [] })
    renderWith(<ApplicationsPanel kind="visa" />)
    await screen.findByText('VISA-0001')

    fireEvent.click(screen.getByText('VISA-0001'))
    expect(screen.getByRole('dialog', { name: 'Sample Applicant 001' })).toBeInTheDocument()
  })
})
