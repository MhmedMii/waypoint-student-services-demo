import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { LanguageProvider } from '../i18n/LanguageContext'
import { NotificationsBell } from './NotificationsBell'
import { openNotificationsPanel } from '../hooks/useAdminNotifications'

const CLEAR = {
  unassignedClients: 0,
  clientsWaitingOnQuietCounselor: 0,
  absentCounselorsWithClientsWaiting: 0,
  clientsWaitingOnAbsentCounselor: 0,
  instantCloseCount: 0,
  leftOpenCount: 0,
}

function mockNotifications(view: Partial<typeof CLEAR>, ok = true) {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok, json: async () => ({ ...CLEAR, ...view }) })
  ) as unknown as typeof fetch
}

function renderBell() {
  return render(
    <LanguageProvider>
      <NotificationsBell />
    </LanguageProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('NotificationsBell', () => {
  it('counts items on the badge, not clients', async () => {
    // ٤ غير معيّنين + ٣ ينتظرون هادئ = سطران، مو سبعة
    mockNotifications({ unassignedClients: 4, clientsWaitingOnQuietCounselor: 3 })
    renderBell()
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument())
  })

  it('shows no badge at all when nothing needs attention', async () => {
    mockNotifications({})
    renderBell()
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    expect(document.querySelector('.bell-count')).toBeNull()
  })

  it('goes amber when only habit items are left', async () => {
    mockNotifications({ instantCloseCount: 2, leftOpenCount: 1 })
    renderBell()
    await waitFor(() => expect(document.querySelector('.bell-count')).not.toBeNull())
    expect(document.querySelector('.bell-count')).toHaveClass('amber')
  })

  it('goes red as soon as a client is waiting', async () => {
    mockNotifications({ unassignedClients: 1, instantCloseCount: 2 })
    renderBell()
    await waitFor(() => expect(document.querySelector('.bell-count')).not.toBeNull())
    expect(document.querySelector('.bell-count')).toHaveClass('red')
  })

  it('opens on click, listing the red items above the amber one', async () => {
    mockNotifications({
      unassignedClients: 4,
      clientsWaitingOnAbsentCounselor: 9,
      absentCounselorsWithClientsWaiting: 3,
      instantCloseCount: 2,
      leftOpenCount: 1,
    })
    renderBell()
    // ٣ أسطر حمراء + سطر برتقالي = ٤ عناصر على الجرس
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button'))
    const titles = Array.from(document.querySelectorAll('.notify-title')).map((n) => n.textContent)
    expect(titles).toEqual([
      '4 clients need a counselor assigned',
      '9 clients stuck with an absent counselor',
      '3 counselors absent with clients waiting',
      'Closed instantly: 2 · left open: 1',
    ])
    expect(document.querySelectorAll('.notify-sev.red')).toHaveLength(3)
    expect(document.querySelectorAll('.notify-sev.amber')).toHaveLength(1)
  })

  // الرقم اللي بالشريط النحيف لازم يطلع من جمع أسطر ظاهرة باللوحة
  it('shows every client the slim line counts, as a row you can add up', async () => {
    mockNotifications({
      unassignedClients: 5,
      clientsWaitingOnQuietCounselor: 3,
      clientsWaitingOnAbsentCounselor: 78,
      absentCounselorsWithClientsWaiting: 7,
    })
    renderBell()
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button'))

    expect(screen.getByText('5 clients need a counselor assigned')).toBeInTheDocument()
    expect(
      screen.getByText('3 clients waiting for a counselor not signed in today')
    ).toBeInTheDocument()
    expect(screen.getByText('78 clients stuck with an absent counselor')).toBeInTheDocument()
    expect(screen.getByText('7 counselors absent with clients waiting')).toBeInTheDocument()
    // ٥ + ٣ + ٧٨ = ٨٦، نفس رقم الشريط
  })

  // الرابط لازم يوصّل لنفس المجموعة اللي عدّها السطر بالضبط — صفحة الزيارات
  // تبدأ بآخر ٧ أيام، فبدون فلتر خاص يضغط المشرف "٧٨" ويلقى عشرة
  it('each item links to the exact set it counted, with no date limit', async () => {
    mockNotifications({
      unassignedClients: 4,
      clientsWaitingOnQuietCounselor: 3,
      clientsWaitingOnAbsentCounselor: 78,
      absentCounselorsWithClientsWaiting: 7,
    })
    renderBell()
    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button'))

    const hrefOf = (text: string) => screen.getByText(text).closest('a')!.getAttribute('href')
    expect(hrefOf('4 clients need a counselor assigned')).toBe('/admin/visits?waiting=unassigned')
    expect(hrefOf('3 clients waiting for a counselor not signed in today')).toBe(
      '/admin/visits?waiting=quiet'
    )
    expect(hrefOf('78 clients stuck with an absent counselor')).toBe('/admin/visits?waiting=absent')
    expect(hrefOf('7 counselors absent with clients waiting')).toBe('/admin/accounts')
  })

  it('says so plainly when there is nothing to show', async () => {
    mockNotifications({})
    renderBell()
    await waitFor(() => expect(screen.getByRole('button')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button'))
    expect(
      screen.getByText(
        'Every client has a counselor, and everyone with clients waiting has signed in today.'
      )
    ).toBeInTheDocument()
  })

  // الشريط النحيف بالداشبورد يفتح نفس اللوحة، وهو بفرع ثاني من الشجرة
  it('opens when the dashboard slim line asks it to', async () => {
    mockNotifications({ unassignedClients: 4 })
    renderBell()
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
    expect(document.querySelector('.notify-panel')).toBeNull()

    fireEvent(window, new CustomEvent('app:open-notifications'))
    await waitFor(() => expect(document.querySelector('.notify-panel')).not.toBeNull())
    expect(typeof openNotificationsPanel).toBe('function')
  })

  // فشل الطلب يترك آخر قيمة معروفة: "٠ ينتظرون" أخطر من رقم قديم
  it('keeps the last known counts when a refresh fails', async () => {
    mockNotifications({ unassignedClients: 4 })
    renderBell()
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())

    global.fetch = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch
    fireEvent(document, new Event('visibilitychange'))
    await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument())
  })
})
