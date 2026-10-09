// src/app/admin/AdminDashboard.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { AdminDashboard } from './AdminDashboard'

function renderAdminDashboard(role: 'admin' | 'super_admin') {
  return render(
    <LanguageProvider>
      <AdminDashboard role={role} />
    </LanguageProvider>
  )
}

const kpis = {
  totalByType: { new: 21, follow_up: 12, visa: 4 },
  countryBreakdown: [{ country: 'US', count: 10 }],
  funnel: { next: 12, closed: 9 },
  counselorPerformance: [
    {
      counselorId: 'demoCounselorOne',
      counselorName: 'Demo Counselor One',
      active: true,
      visitCount: 14,
      closedCount: 9,
      avgHandlingMs: 1080000,
      applicationCount: 2,
    },
    {
      counselorId: 'unassigned',
      counselorName: '',
      visitCount: 2,
      closedCount: 0,
      avgHandlingMs: null,
      applicationCount: 0,
    },
  ],
  turnaround: { within24h: 5, over24h: 2, inProgress: 3 },
  followUpsDue: { total: 0, overdue: 0 },
}
const counselors = [{ id: 'demoCounselorOne', name: 'Demo Counselor One' }]

beforeEach(() => {
  global.fetch = vi.fn((url: string) => {
    if (url === '/api/counselors/active')
      return Promise.resolve({ ok: true, json: async () => counselors })
    if (url.startsWith('/api/admin/notifications'))
      return Promise.resolve({ ok: true, json: async () => CLEAR_NOTIFICATIONS })
    return Promise.resolve({ ok: true, json: async () => kpis })
  }) as any
})

const CLEAR_NOTIFICATIONS = {
  unassignedClients: 0,
  clientsWaitingOnQuietCounselor: 0,
  absentCounselorsWithClientsWaiting: 0,
  clientsWaitingOnAbsentCounselor: 0,
  instantCloseCount: 0,
  leftOpenCount: 0,
}

function mockWith(notifications: Partial<typeof CLEAR_NOTIFICATIONS>) {
  global.fetch = vi.fn((url: string) => {
    if (url === '/api/counselors/active')
      return Promise.resolve({ ok: true, json: async () => counselors })
    if (url.startsWith('/api/admin/notifications'))
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...CLEAR_NOTIFICATIONS, ...notifications }),
      })
    return Promise.resolve({ ok: true, json: async () => kpis })
  }) as any
}

describe('the slim line that replaced the three banners', () => {
  it('counts clients, not items, and offers the panel', async () => {
    // ٤ غير معيّنين + ٣ ينتظرون هادئ + ١ ينتظر غايب = ٨ عملاء، من ٣ أسطر
    mockWith({
      unassignedClients: 4,
      clientsWaitingOnQuietCounselor: 3,
      clientsWaitingOnAbsentCounselor: 1,
      absentCounselorsWithClientsWaiting: 1,
    })
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('8 clients need attention')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Open notifications/ })).toBeInTheDocument()
  })

  it('is not rendered at all when nothing is red', async () => {
    mockWith({})
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(document.querySelector('.slim-line')).toBeNull()
  })

  // العادات وحدها برتقالية — ما توقف عميل، فما تستاهل سطر أحمر بالداشبورد
  it('stays hidden when only instant closes and left-open visits remain', async () => {
    mockWith({ instantCloseCount: 5, leftOpenCount: 2 })
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(document.querySelector('.slim-line')).toBeNull()
  })

  it('no longer renders any of the three orange banners', async () => {
    mockWith({ unassignedClients: 4, instantCloseCount: 5 })
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(document.querySelector('.focus-banner')).toBeNull()
  })
})

describe('AdminDashboard', () => {
  it('shows KPI numbers for an admin viewer', async () => {
    renderAdminDashboard('admin')
    await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())
    expect(screen.queryByText('Accounts')).not.toBeInTheDocument()
  })

  // كان "View / print QR code" بقسم منفصل آخر الصفحة — نقلناه يجاور "Export to
  // Excel" بنفس صف التواريخ، وحذفنا القسم القديم كامل بدل ما نخلي أثر فاضي له
  it('puts the QR code link in the same row as Export to Excel, with the old section gone', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Export to Excel')).toBeInTheDocument())

    const exportLink = screen.getByText('Export to Excel').closest('a')!
    const qrLink = screen.getByText('View / print QR code').closest('a')!
    expect(exportLink.parentElement).toBe(qrLink.parentElement)
    expect(exportLink.parentElement).toHaveClass('date-range-row')
    expect(document.querySelector('.dash-panel-qr')).not.toBeInTheDocument()
  })

  it('resolves counselor UUIDs to names in the performance table', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(screen.queryByText('demoCounselorOne')).not.toBeInTheDocument()
  })

  it('links the unassigned row straight to its filtered visits', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('— unassigned —')).toBeInTheDocument())
    const row = screen.getByText('— unassigned —').closest('tr')!
    const link = within(row).getByRole('link', { name: /View visits/ })
    expect(link).toHaveAttribute('href', '/admin/visits?counselor=unassigned')
  })

  // Reassign كان يفتح فورم يطلب Visit ID يدوي ما تعرضه هالشاشة أبدًا — استبدلناه
  // برابط يوديك مباشرة لزيارات هالمستشار بصفحة الزيارات
  it('links a counselor row straight to their filtered visits', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    const row = screen.getByText('Demo Counselor One').closest('tr')!
    const link = within(row).getByRole('link', { name: /View visits/ })
    expect(link).toHaveAttribute('href', '/admin/visits?counselor=demoCounselorOne')
  })

  it('still links a deactivated counselor to their visits, so their backlog can be reassigned', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'gone',
              counselorName: 'Left The Company',
              active: false,
              visitCount: 3,
              closedCount: 1,
              avgHandlingMs: 0,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Left The Company')).toBeInTheDocument())

    const row = screen.getByText('Left The Company').closest('tr')!
    const link = within(row).getByRole('link', { name: /View visits/ })
    expect(link).toHaveAttribute('href', '/admin/visits?counselor=gone')
  })

  it('shows "Absent Nd" instead of "Overloaded" for a counselor with a stale last-seen date', async () => {
    // الخميس 17 سبتمبر ظهراً بتوقيت الكويت؛ آخر دخول الثلاثاء 1 سبتمبر = 12 يوم دوام
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-17T09:00:00Z'))
    const sixteenDaysAgo = '2026-09-01T09:00:00.000Z'
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorOne',
              counselorName: 'Demo Counselor One',
              active: true,
              lastSeenAt: sixteenDaysAgo,
              visitCount: 16,
              closedCount: 0,
              avgHandlingMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    expect(screen.getByText('Absent 12 working days')).toBeInTheDocument()
    expect(screen.queryByText('Overloaded')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('turns the Absent badge red once it passes a full working week, but keeps it neutral before that', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-17T09:00:00Z'))
    // الاثنين 14 سبتمبر = 3 أيام دوام، والثلاثاء 1 سبتمبر = 12 يوم دوام
    const threeDaysAgo = '2026-09-14T09:00:00.000Z'
    const sixteenDaysAgo = '2026-09-01T09:00:00.000Z'
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorSeven',
              counselorName: 'Demo Counselor D',
              active: true,
              lastSeenAt: threeDaysAgo,
              visitCount: 5,
              closedCount: 0,
              avgHandlingMs: null,
              applicationCount: 0,
            },
            {
              counselorId: 'demoCounselorOne',
              counselorName: 'Demo Counselor One',
              active: true,
              lastSeenAt: sixteenDaysAgo,
              visitCount: 16,
              closedCount: 0,
              avgHandlingMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    expect(screen.getByText('Absent 3 working days')).toHaveClass('absent')
    expect(screen.getByText('Absent 3 working days')).not.toHaveClass('inactive')
    expect(screen.getByText('Absent 12 working days')).toHaveClass('inactive')
    vi.useRealTimers()
  })

  it('does not call a counselor absent on Sunday morning for missing the weekend', async () => {
    // الأحد 20 سبتمبر الصبح، وآخر دخول الخميس 17 — الجمعة والسبت ما يُحسبان،
    // فهذا يوم دوام واحد بس. بالحساب القديم كان يطلع "غايب 3 أيام" لكل الفريق
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-20T06:00:00Z'))
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorSeven',
              counselorName: 'Demo Counselor D',
              active: true,
              lastSeenAt: '2026-09-17T14:00:00.000Z',
              visitCount: 5,
              closedCount: 0,
              avgHandlingMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor D')).toBeInTheDocument())

    expect(screen.queryByText(/Absent/)).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('hides the absent-with-waiting banner when nobody absent has open visits', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(screen.queryByText(/counselors are absent/)).not.toBeInTheDocument()
  })

  it('still shows "Overloaded" for a counselor with a heavy backlog who was seen recently', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorOne',
              counselorName: 'Demo Counselor One',
              active: true,
              lastSeenAt: new Date().toISOString(),
              visitCount: 16,
              closedCount: 0,
              avgHandlingMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    expect(screen.getByText('Overloaded')).toBeInTheDocument()
  })

  it('shows "—" and just the count when every session is an instant close, not a repeated average', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorSeven',
              counselorName: 'Demo Counselor D',
              active: true,
              lastSeenAt: new Date().toISOString(),
              visitCount: 5,
              closedCount: 5,
              avgHandlingMs: null,
              instantCloseCount: 5,
              instantCloseAvgMs: 12000,
              leftOpenCount: 0,
              leftOpenAvgMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor D')).toBeInTheDocument())

    const row = screen.getByText('Demo Counselor D').closest('tr')!
    const avgCell = row.querySelector('[data-label="Avg. time"]')!
    expect(avgCell.textContent).toContain('—')
    expect(avgCell.textContent).not.toContain('0h 0m 12s')
    expect(within(row).getByText('5 instant')).toBeInTheDocument()
  })

  it('shows the real average alongside a badge when some sessions are real and some are outliers', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'fai',
              counselorName: 'Demo Counselor G',
              active: true,
              lastSeenAt: new Date().toISOString(),
              visitCount: 6,
              closedCount: 6,
              avgHandlingMs: 6 * 3600000,
              instantCloseCount: 4,
              instantCloseAvgMs: 8000,
              leftOpenCount: 1,
              leftOpenAvgMs: 21 * 3600000,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor G')).toBeInTheDocument())

    const row = screen.getByText('Demo Counselor G').closest('tr')!
    const avgCell = row.querySelector('[data-label="Avg. time"]')!
    expect(avgCell.textContent).toContain('6h')
    expect(avgCell.textContent).toContain('(1 visit)')
    expect(within(row).getByText('4 instant')).toBeInTheDocument()
    expect(within(row).getByText('1 left open')).toBeInTheDocument()
  })

  it('shows a long average as "6h 1m" instead of a hard-to-read "361 min"', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorOne',
              counselorName: 'Demo Counselor One',
              active: true,
              lastSeenAt: new Date().toISOString(),
              visitCount: 3,
              closedCount: 3,
              avgHandlingMs: 361 * 60000,
              instantCloseCount: 0,
              instantCloseAvgMs: null,
              leftOpenCount: 0,
              leftOpenAvgMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    const row = screen.getByText('Demo Counselor One').closest('tr')!
    const avgCell = row.querySelector('[data-label="Avg. time"]')!
    expect(avgCell.textContent).toContain('6h 1m')
    expect(avgCell.textContent).not.toContain('361 min')
  })

  it('keeps the plain minutes format at exactly 60 minutes', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({
          ...kpis,
          counselorPerformance: [
            {
              counselorId: 'demoCounselorOne',
              counselorName: 'Demo Counselor One',
              active: true,
              lastSeenAt: new Date().toISOString(),
              visitCount: 3,
              closedCount: 3,
              avgHandlingMs: 60 * 60000,
              instantCloseCount: 0,
              instantCloseAvgMs: null,
              leftOpenCount: 0,
              leftOpenAvgMs: null,
              applicationCount: 0,
            },
          ],
        }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    const row = screen.getByText('Demo Counselor One').closest('tr')!
    const avgCell = row.querySelector('[data-label="Avg. time"]')!
    expect(avgCell.textContent).toContain('60 min')
  })

  it('hides the handling-quality banner when there are no instant closes or left-open visits', async () => {
    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())
    expect(screen.queryByText(/Closed instantly/)).not.toBeInTheDocument()
  })

  it('shows the Follow-ups due card, flagged red with an overdue count when any are overdue', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...kpis, followUpsDue: { total: 5, overdue: 2 } }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Follow-ups due')).toBeInTheDocument())

    const card = screen.getByText('Follow-ups due').closest<HTMLElement>('.kpi-card')!
    expect(card).toHaveClass('kpi-card-bad')
    expect(within(card).getByText('5')).toBeInTheDocument()
    expect(within(card).getByText('2 overdue')).toBeInTheDocument()
  })

  it('does not flag the Follow-ups due card when nothing is overdue', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({
        ok: true,
        json: async () => ({ ...kpis, followUpsDue: { total: 3, overdue: 0 } }),
      })
    }) as any

    renderAdminDashboard('super_admin')
    await waitFor(() => expect(screen.getByText('Follow-ups due')).toBeInTheDocument())

    const card = screen.getByText('Follow-ups due').closest<HTMLElement>('.kpi-card')!
    expect(card).not.toHaveClass('kpi-card-bad')
    expect(screen.queryByText(/overdue/)).not.toBeInTheDocument()
  })

  it('switches to the country-breakdown panel via its tab', async () => {
    renderAdminDashboard('admin')
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Desired country breakdown'))

    await waitFor(() => expect(screen.getByText('US')).toBeInTheDocument())
  })

  it('shows an error instead of broken numbers when the KPI request fails', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({ ok: false, json: async () => ({ ok: false }) })
    }) as any

    renderAdminDashboard('admin')
    await waitFor(() =>
      expect(screen.getByText('Could not load the KPI dashboard')).toBeInTheDocument()
    )
  })

  it('requests a "to" date one day past the selected day, so the selected day is fully included', async () => {
    const calledUrls: string[] = []
    global.fetch = vi.fn((url: string) => {
      calledUrls.push(url)
      if (url.startsWith('/api/counselors/active'))
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({ ok: true, json: async () => kpis })
    }) as any

    renderAdminDashboard('admin')
    await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())

    const kpisUrl = calledUrls.find((u) => u.startsWith('/api/admin/kpis'))
    const toParam = new URL(kpisUrl!, 'http://localhost').searchParams.get('to')
    const today = new Date().toISOString().slice(0, 10)
    expect(toParam).not.toBe(today)
    expect(new Date(toParam!).getTime()).toBeGreaterThan(new Date(today).getTime())
  })

  it('exports the same date range currently shown on the dashboard', async () => {
    renderAdminDashboard('admin')
    await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())

    const exportLink = screen.getByText('Export to Excel').closest('a')
    const exportUrl = new URL(exportLink!.getAttribute('href')!, 'http://localhost')
    const today = new Date().toISOString().slice(0, 10)
    expect(exportUrl.searchParams.get('from')).not.toBeNull()
    expect(exportUrl.searchParams.get('to')).not.toBe(today)
  })

  it('widens the date range and refetches when a preset like "Yearly" is picked', async () => {
    const calledUrls: string[] = []
    global.fetch = vi.fn((url: string) => {
      calledUrls.push(url)
      if (url.startsWith('/api/counselors/active'))
        return Promise.resolve({ ok: true, json: async () => counselors })
      return Promise.resolve({ ok: true, json: async () => kpis })
    }) as any

    renderAdminDashboard('admin')
    await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())
    calledUrls.length = 0

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'year' } })

    await waitFor(() => expect(calledUrls.some((u) => u.startsWith('/api/admin/kpis'))).toBe(true))
    const kpisUrl = calledUrls.find((u) => u.startsWith('/api/admin/kpis'))!
    const fromParam = new URL(kpisUrl, 'http://localhost').searchParams.get('from')
    // بداية السنة بتوقيت الكويت = 9 مساءً UTC من اليوم اللي قبله
    const kuwaitYear = new Date(Date.now() + 3 * 3600000).getUTCFullYear()
    expect(fromParam).toBe(new Date(Date.UTC(kuwaitYear, 0, 1) - 3 * 3600000).toISOString())
  })

  describe('date range follows the calendar', () => {
    let refreshTimer: (() => void) | undefined
    let calledKpiUrls: string[]

    function kpiParams(index = -1) {
      const url = calledKpiUrls.at(index)!
      const params = new URL(url, 'http://localhost').searchParams
      return { from: params.get('from'), to: params.get('to') }
    }

    async function tick(nextNow?: string) {
      if (nextNow) vi.setSystemTime(new Date(nextNow))
      await act(async () => {
        refreshTimer!()
      })
    }

    async function renderAt(nowIso: string) {
      vi.setSystemTime(new Date(nowIso))
      renderAdminDashboard('admin')
      await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      refreshTimer = undefined
      calledKpiUrls = []
      const realSetInterval = window.setInterval.bind(window)
      vi.spyOn(window, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
        if (ms === 60_000) {
          refreshTimer = fn
          return 0
        }
        return realSetInterval(fn, ms)
      }) as any)
      global.fetch = vi.fn((url: string) => {
        if (url.startsWith('/api/admin/kpis')) calledKpiUrls.push(url)
        if (url === '/api/counselors/active')
          return Promise.resolve({ ok: true, json: async () => counselors })
        return Promise.resolve({ ok: true, json: async () => kpis })
      }) as any
    })

    afterEach(() => {
      vi.restoreAllMocks()
      vi.useRealTimers()
    })

    it('starts on the last 7 days ending today by Kuwait time, even when UTC is still yesterday', async () => {
      // 10:30 مساءً UTC = 1:30 فجراً بالكويت، اليوم التالي
      await renderAt('2026-09-20T22:30:00Z')
      expect(screen.getByLabelText('From')).toHaveValue('2026-09-14')
      expect(screen.getByLabelText('To')).toHaveValue('2026-09-21')
      // الطلب يقطع عند منتصف الليل بالكويت (9 مساءً UTC)، مو منتصف ليل UTC
      expect(kpiParams()).toEqual({
        from: '2026-09-13T21:00:00.000Z',
        to: '2026-09-21T21:00:00.000Z',
      })
    })

    it('rolls the default range forward when the day changes while the page stays open', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      expect(screen.getByLabelText('To')).toHaveValue('2026-09-17')

      await tick('2026-09-20T09:00:00Z')

      expect(screen.getByLabelText('From')).toHaveValue('2026-09-13')
      expect(screen.getByLabelText('To')).toHaveValue('2026-09-20')
      expect(kpiParams().to).toBe('2026-09-20T21:00:00.000Z')
    })

    it('keeps the range the admin picked by hand, however many days pass', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } })
      fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-31' } })

      await tick('2026-09-25T09:00:00Z')

      expect(screen.getByLabelText('From')).toHaveValue('2026-08-01')
      expect(screen.getByLabelText('To')).toHaveValue('2026-08-31')
      expect(kpiParams().to).toBe('2026-08-31T21:00:00.000Z')
    })

    it('keeps a chosen preset following today instead of freezing its dates', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'month' } })
      expect(screen.getByLabelText('From')).toHaveValue('2026-09-01')

      await tick('2026-10-02T09:00:00Z')

      expect(screen.getByLabelText('From')).toHaveValue('2026-10-01')
      expect(screen.getByLabelText('To')).toHaveValue('2026-10-02')
    })

    it('picking a preset replaces dates that were typed by hand', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-01' } })
      fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'week' } })
      expect(screen.getByLabelText('From')).toHaveValue('2026-09-10')
    })

    it('reloads the numbers on every refresh tick, even when the dates did not change', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      const before = calledKpiUrls.length
      await tick()
      await tick()
      expect(calledKpiUrls.length).toBe(before + 2)
    })

    it('reloads when the tab becomes visible again', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      const before = calledKpiUrls.length
      await act(async () => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(calledKpiUrls.length).toBe(before + 1)
    })

    it('does not wipe the numbers when a background refresh fails', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as any

      await tick()

      expect(screen.getByText('21')).toBeInTheDocument()
      expect(screen.queryByText('Could not load the KPI dashboard')).not.toBeInTheDocument()
    })

    it('recovers from a failed first load on the next refresh', async () => {
      global.fetch = vi.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as any
      vi.setSystemTime(new Date('2026-09-17T09:00:00Z'))
      renderAdminDashboard('admin')
      await waitFor(() =>
        expect(screen.getByText('Could not load the KPI dashboard')).toBeInTheDocument()
      )

      global.fetch = vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () => (url === '/api/counselors/active' ? counselors : kpis),
        })
      ) as any
      await tick()

      await waitFor(() => expect(screen.getByText('21')).toBeInTheDocument())
    })

    it('ignores an older response that arrives after a newer one', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      const resolvers: Array<(value: unknown) => void> = []
      global.fetch = vi.fn(() => new Promise((resolve) => resolvers.push(resolve))) as any
      const newer = { ...kpis, totalByType: { new: 99, follow_up: 0, visa: 0 } }

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } })
      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-05' } })
      await waitFor(() => expect(resolvers).toHaveLength(2))

      await act(async () => {
        resolvers[1]({ ok: true, json: async () => newer })
      })
      await act(async () => {
        resolvers[0]({ ok: true, json: async () => kpis })
      })

      expect(screen.getByText('99')).toBeInTheDocument()
      expect(screen.queryByText('21')).not.toBeInTheDocument()
    })

    it('does not send a request or crash when a date box is cleared', async () => {
      await renderAt('2026-09-17T09:00:00Z')
      const before = calledKpiUrls.length

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '' } })

      expect(calledKpiUrls.length).toBe(before)
      expect(screen.getByText('21')).toBeInTheDocument()
      expect(screen.getByText('Export to Excel').closest('a')).not.toHaveAttribute('href')
    })

    it('exports exactly the range it is loading, cut at Kuwait midnight', async () => {
      await renderAt('2026-09-20T22:30:00Z')
      const href = screen.getByText('Export to Excel').closest('a')!.getAttribute('href')!
      const params = new URL(href, 'http://localhost').searchParams
      expect(params.get('from')).toBe('2026-09-13T21:00:00.000Z')
      expect(params.get('to')).toBe('2026-09-21T21:00:00.000Z')
    })
  })

  // كانت هالشاشة تعرض قيمة الدولة الخام من قاعدة البيانات، فتبقى إنجليزي حتى
  // بالوضع العربي — بعكس كل تسمية ثانية بنفس الصفحة. آخر تست بالملف عمدًا،
  // نفس القاعدة المتبعة بملف IntakeForm.test.tsx، عشان تبديل اللغة ما يسرّب لتستات ثانية
  it('translates the destination in the country-breakdown chart', async () => {
    document.cookie = 'app-language=ar; path=/'
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: async () => ({ ...kpis, countryBreakdown: [{ country: 'USA', count: 10 }] }),
      })
    ) as any

    renderAdminDashboard('admin')
    // اسم المستشار قيمة بيانات، ما يترجم — يبقى كما هو بأي لغة
    await waitFor(() => expect(screen.getByText('Demo Counselor One')).toBeInTheDocument())

    fireEvent.click(screen.getByText('توزيع الدول المطلوبة'))

    await waitFor(() => expect(screen.getByText('أمريكا')).toBeInTheDocument())
    expect(screen.queryByText('USA')).not.toBeInTheDocument()
  })
})
