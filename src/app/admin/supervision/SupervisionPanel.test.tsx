import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../../i18n/LanguageContext'
import { SupervisionPanel } from './SupervisionPanel'

function mockSupervision(rows: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => rows }))
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    name: 'Demo Counselor Two',
    nameAr: 'مستشار تجريبي ثان',
    isOnline: true,
    onlineSecondsToday: 8400,
    status: 'in_session',
    currentSince: new Date(Date.now() - 17 * 60000).toISOString(),
    closedToday: 19,
    avgHandlingMs: 11 * 60000,
    breakMsToday: 0,
    ...overrides,
  }
}

describe('SupervisionPanel', () => {
  it('groups counselors by status instead of showing every card at once', async () => {
    mockSupervision([
      row(),
      row({
        id: 'u2',
        name: 'Demo Counselor One',
        nameAr: null,
        status: 'on_break',
        currentSince: new Date().toISOString(),
      }),
    ])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    await screen.findByText('Demo Counselor Two')
    expect(screen.getAllByText(/With a student/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/On break/).length).toBeGreaterThan(0)
    expect(document.querySelector('.sup-grid')).not.toBeInTheDocument()
  })

  it('shows the 3 metrics on one line per counselor', async () => {
    mockSupervision([row()])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    await screen.findByText('Demo Counselor Two')
    const metrics = document.querySelector('.sup-inline-metrics')?.textContent ?? ''
    expect(metrics).toContain('19')
    expect(metrics).toContain('Closed today')
    expect(metrics).toContain('0h 11m 0s')
    expect(metrics).toContain('Avg handling')
  })

  it('shows "—" and just the count when every session today was an instant close', async () => {
    mockSupervision([
      row({
        closedToday: 5,
        avgHandlingMs: null,
        instantCloseCount: 5,
        instantCloseAvgMs: 12000,
        leftOpenCount: 0,
        leftOpenAvgMs: null,
      }),
    ])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    await screen.findByText('Demo Counselor Two')
    const metrics = document.querySelector('.sup-inline-metrics')?.textContent ?? ''
    expect(metrics).toContain('5 instant')
    expect(metrics).toContain('—')
    expect(metrics).not.toContain('0h 0m 12s')
  })

  it('flags a real average built from just one visit', async () => {
    mockSupervision([
      row({
        closedToday: 6,
        avgHandlingMs: 6 * 3600000,
        instantCloseCount: 4,
        instantCloseAvgMs: 8000,
        leftOpenCount: 1,
        leftOpenAvgMs: 21 * 3600000,
      }),
    ])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    await screen.findByText('Demo Counselor Two')
    const metrics = document.querySelector('.sup-inline-metrics')?.textContent ?? ''
    expect(metrics).toContain('6h 0m 0s')
    expect(metrics).toContain('(1 visit)')
    expect(metrics).toContain('4 instant')
    expect(metrics).toContain('1 left open')
  })

  it('shows the Arabic name instead of the Latin one in Arabic mode', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockSupervision([row()])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    expect(await screen.findByText('مستشار تجريبي ثان')).toBeInTheDocument()
    document.cookie = 'app-language=; path=/; max-age=0'
  })

  it('groups an offline-but-was-online-today counselor under Away, with time since last seen', async () => {
    mockSupervision([
      row({
        id: 'u2',
        name: 'Demo Counselor Five',
        nameAr: null,
        isOnline: false,
        status: 'away',
        currentSince: null,
        lastSeenAt: new Date(Date.now() - 65 * 60000).toISOString(),
      }),
    ])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    await screen.findByText('Demo Counselor Five')
    expect(screen.getAllByText(/Away/).length).toBeGreaterThan(0)
    expect(document.querySelector('.g-status')?.textContent).toContain('1h 5m')
  })

  it('shows the empty state when no counselors are present', async () => {
    mockSupervision([])
    render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )

    expect(await screen.findByText('No counselors to show')).toBeInTheDocument()
  })
})

describe('SupervisionPanel: telling an empty board from a broken one', () => {
  // تست اللغة العربية قبلنا بالملف يسيب app-language — ننظّف عشان نتأكد من النص الإنجليزي
  beforeEach(() => {
    localStorage.clear()
  })

  function renderPanel() {
    return render(
      <LanguageProvider>
        <SupervisionPanel />
      </LanguageProvider>
    )
  }

  it('says it is loading, not that there are no counselors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    )
    renderPanel()
    expect(screen.getByText('Loading the supervision board…')).toBeInTheDocument()
    expect(screen.queryByText('No counselors to show')).not.toBeInTheDocument()
  })

  it('offers a retry when the request fails, and recovers on the retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue({ ok: true, status: 200, json: async () => [row()] })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()

    expect(await screen.findByText('Could not load supervision')).toBeInTheDocument()
    expect(screen.queryByText('No counselors to show')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Demo Counselor Two')).toBeInTheDocument()
  })

  it('treats a 500 as a failure, not as an empty board', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    )
    renderPanel()
    expect(await screen.findByText('Could not load supervision')).toBeInTheDocument()
  })

  it('asks the supervisor to sign in again when the session has ended', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ ok: false }) })
    )
    renderPanel()

    expect(await screen.findByText('Your session has ended')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
    // هذي بالذات كانت تطلع "ما فيه مستشارين" على شاشة متروكة مفتوحة طول الليل
    expect(screen.queryByText('No counselors to show')).not.toBeInTheDocument()
  })

  it('only points at Accounts when the board is genuinely empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] })
    )
    renderPanel()

    expect(await screen.findByText('No counselors to show')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Accounts' })).toBeInTheDocument()
  })

  it('keeps the board up when a later refresh fails, with an honest note', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => [row()] })
      .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()
    await screen.findByText('Demo Counselor Two')

    document.dispatchEvent(new Event('visibilitychange'))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Last updated/))
    // الأرقام تبقى مكانها — ما نمسح شاشة إشراف شغالة
    expect(screen.getByText('Demo Counselor Two')).toBeInTheDocument()
    expect(screen.queryByText('Could not load supervision')).not.toBeInTheDocument()
  })

  it('never blanks the board when a status it does not know arrives', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          row({ status: 'lunch' }),
          row({ id: 'u2', name: 'Sample Two', nameAr: null }),
        ],
      })
    )
    renderPanel()

    // الصف بالوضع المجهول ينعرض تحت "أخرى" بدل ما يختفي ويخلي اللوحة فاضية
    expect(await screen.findByText('Sample Two')).toBeInTheDocument()
    expect(screen.getByText(/Other/)).toBeInTheDocument()
    expect(screen.queryByText('No counselors to show')).not.toBeInTheDocument()
  })

  it('does not claim the accounts are inactive when rows did arrive', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, status: 200, json: async () => [row({ status: 'lunch' })] })
    )
    renderPanel()
    await screen.findByText('Demo Counselor Two')
    expect(screen.queryByText(/Activate one in Accounts/)).not.toBeInTheDocument()
  })

  it('gives up on a request that never answers, instead of loading forever', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    // طلب ما يرد أبدًا — بالضبط اللي كان يخلي الشاشة عالقة
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
          })
      )
    )
    renderPanel()
    expect(screen.getByText('Loading the supervision board…')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(11000)

    expect(await screen.findByText('Could not load supervision')).toBeInTheDocument()
    expect(screen.getByText(/took too long/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('asks the server only once on mount, not twice', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: async () => [row()] })
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()
    await screen.findByText('Demo Counselor Two')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a dash for break time when none was recorded, not a row of zeros', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          row({ status: 'offline', breakMsToday: 0 }),
          row({ id: 'u2', name: 'Sample Two', nameAr: null, breakMsToday: 15 * 60000 }),
        ],
      })
    )
    renderPanel()
    await screen.findByText('Demo Counselor Two')

    // الصفوف تتجمّع حسب الحالة، فالترتيب بالصفحة مو ترتيب المصفوفة — ندوّر بالاسم
    const noBreak = screen.getByText('Demo Counselor Two').closest('.group-row')!
    expect(noBreak).toHaveTextContent('— Break time today')
    expect(noBreak).not.toHaveTextContent('0h 0m 0s')
    // اللي أخذ استراحة فعلاً يظل يبيّن المدة
    expect(screen.getByText('Sample Two').closest('.group-row')!).toHaveTextContent('0h 15m 0s')
  })

  function metricsFor(name: string) {
    return screen.getByText(name).closest('.group-row')!.querySelector('.sup-inline-metrics')!
  }

  it('puts the instant count after the average, with no run-together text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          row({ closedToday: 3, avgHandlingMs: 15 * 60000, instantCloseCount: 2 }),
        ],
      })
    )
    renderPanel()
    await screen.findByText('Demo Counselor Two')

    const text = metricsFor('Demo Counselor Two').textContent ?? ''
    // كان يطلع "2 instantAvg handling" ملصوقين — الوسم كان محشور بين الرقم واسمه
    expect(text).not.toMatch(/instantAvg/)
    expect(text).toContain('Avg handling')
    expect(text.indexOf('Avg handling')).toBeLessThan(text.indexOf('2 instant today'))
  })

  it('labels the count as today, because this board counts today only', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [row({ instantCloseCount: 2 })],
      })
    )
    renderPanel()
    expect(await screen.findByText('2 instant today')).toBeInTheDocument()
  })

  it('shows the instant count as an orange pill only when there is one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          row({ instantCloseCount: 2 }),
          row({ id: 'u2', name: 'Sample Two', nameAr: null, instantCloseCount: 0 }),
        ],
      })
    )
    renderPanel()
    await screen.findByText('Demo Counselor Two')

    expect(screen.getByText('2 instant today')).toHaveClass('pill', 'instant')
    // صفر يطلع شرطة مثل باقي الأعمدة، بدون بادج
    expect(metricsFor('Sample Two').textContent).toContain('— instant today')
    expect(metricsFor('Sample Two').querySelector('.pill.instant')).toBeNull()
  })

  it('leaves the left-open badge amber and unchanged, and keeps it out of the label', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [row({ leftOpenCount: 1, instantCloseCount: 0 })],
      })
    )
    renderPanel()

    const badge = await screen.findByText('1 left open')
    expect(badge).toHaveClass('pill', 'watch')
    expect(metricsFor('Demo Counselor Two').textContent).not.toMatch(/left openAvg/)
  })

  it('has no red threshold: a high count is still orange', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [row({ instantCloseCount: 9 })],
      })
    )
    renderPanel()

    const badge = await screen.findByText('9 instant today')
    expect(badge).toHaveClass('instant')
    expect(badge).not.toHaveClass('inactive')
  })
})
