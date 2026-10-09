// src/app/admin/visits/VisitsPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { LanguageProvider } from '../../../i18n/LanguageContext'
import { VisitsPanel } from './VisitsPanel'

let searchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useSearchParams: () => searchParams,
}))

function renderVisitsPanel(role: 'admin' | 'super_admin' = 'super_admin') {
  return render(
    <LanguageProvider>
      <VisitsPanel role={role} />
    </LanguageProvider>
  )
}

function visitsList() {
  return [
    {
      id: 'v1',
      type: 'new',
      desiredCountry: 'USA',
      name: 'Demo Student One',
      phone: '0500000001',
      counselorId: null,
      counselorName: null,
      counselorNameAr: null,
      counselorSignedInToday: null,
      counselorQuietWorkingDays: null,
      status: 'next',
      studentStatus: null,
      createdAt: '2026-01-01T10:00:00.000Z',
      pickedUpAt: null,
      closedAt: null,
      note: null,
    },
    {
      id: 'v2',
      type: 'follow_up',
      desiredCountry: null,
      name: 'Fictional Student R',
      phone: '0500000002',
      counselorId: 'c1',
      counselorName: 'Fictional Student K',
      counselorNameAr: 'طالب تجريبي ثان',
      counselorSignedInToday: true,
      counselorQuietWorkingDays: 0,
      status: 'next',
      studentStatus: null,
      createdAt: '2026-01-02T10:00:00.000Z',
      pickedUpAt: null,
      closedAt: null,
      note: null,
    },
  ]
}

// الدروب داون للتعيين فقط: مين يقدر يستلم الحين. التسمية ما تجي من هنا أبدًا
function counselorsList() {
  return [{ id: 'c1', name: 'Fictional Student K', nameAr: 'طالب تجريبي ثان' }]
}

function allCounselorsList() {
  return [
    ...counselorsList(),
    // بدوام ليلي: مُعيَّن، بس مو بقائمة النشطين الحين
    { id: 'c2', name: 'Off Shift Counselor', nameAr: 'مستشار خارج الدوام' },
  ]
}

function mockFetchDefault() {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url.startsWith('/api/admin/visits/total')) {
      return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
    }
    if (url.startsWith('/api/admin/visits?') || url === '/api/admin/visits') {
      return Promise.resolve({ ok: true, json: async () => visitsList() }) as any
    }
    if (url === '/api/counselors/all') {
      return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
    }
    if (url === '/api/counselors/active') {
      return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
    }
    if (url.startsWith('/api/applications/kind/')) {
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }
    if (url === '/api/admin/reassign') {
      return Promise.resolve({ ok: true, json: async () => ({ ok: true }) }) as any
    }
    if (url.startsWith('/api/admin/visits/') && init?.method === 'DELETE') {
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: false, reason: 'onlySuperAdmin' }),
      }) as any
    }
    return Promise.resolve({ ok: true, json: async () => [] }) as any
  })
}

describe('VisitsPanel', () => {
  beforeEach(() => {
    global.fetch = mockFetchDefault() as any
    searchParams = new URLSearchParams()
    localStorage.clear()
  })

  it('sorts by clicking a column header and toggles direction on repeat clicks', async () => {
    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    const nameHeaderBtn = screen.getByRole('button', { name: /^Name/ })
    const rowOrder = () =>
      screen
        .getAllByRole('row')
        .slice(1)
        .map((row) => within(row).queryAllByRole('cell')[0]?.textContent)

    fireEvent.click(nameHeaderBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name/ })).toHaveTextContent('↑')
    })
    expect(rowOrder()[0]).toContain('Demo Student One')

    fireEvent.click(nameHeaderBtn)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Name/ })).toHaveTextContent('↓')
    })
    expect(rowOrder()[0]).toContain('Fictional Student R')
  })

  it('shows an inline error inside the confirm modal on delete failure, instead of alerting', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderVisitsPanel()
    await screen.findByText('Fictional Student R')

    const row = screen.getByText('Fictional Student R').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialogDeleteBtn = screen
      .getAllByRole('button', { name: 'Delete' })
      .find((b) => b.closest('.confirm-modal-actions'))!
    fireEvent.click(dialogDeleteBtn)

    expect(await screen.findByText('Only super_admin can perform this action')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    expect(alertSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByText('Only super_admin can perform this action')).not.toBeInTheDocument()
    alertSpy.mockRestore()
  })

  it('shows the destination under the type, and nothing for visits that never asked', async () => {
    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    const typeCellOf = (name: string) =>
      within(screen.getByText(name).closest('tr')!).getAllByRole('cell')[2]

    expect(within(typeCellOf('Demo Student One')).getByText('USA')).toBeInTheDocument()

    // زيارة المتابعة ما تسأل عن وجهة، فخلية النوع تبقى نظيفة — بدون شرطة ولا فراغ محجوز
    expect(typeCellOf('Fictional Student R')).toHaveTextContent('Follow up')
    expect(typeCellOf('Fictional Student R').querySelector('.row-sub')).toBeNull()
  })

  it('auto-assigns a counselor on select change, and unassigns via the ✕ button', async () => {
    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    const unassignedRow = screen.getByText('Demo Student One').closest('tr')!
    const select = within(unassignedRow).getByRole('combobox')
    fireEvent.change(select, { target: { value: 'c1' } })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reassign',
        expect.objectContaining({
          body: JSON.stringify({ visitId: 'v1', counselorId: 'c1' }),
        })
      )
    })

    const assignedRow = screen.getByText('Fictional Student R').closest('tr')!
    expect(within(assignedRow).getByText('Fictional Student K')).toBeInTheDocument()
    fireEvent.click(within(assignedRow).getByTitle('Unassign'))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reassign',
        expect.objectContaining({
          body: JSON.stringify({ visitId: 'v2', counselorId: null }),
        })
      )
    })
  })

  // يجي من رابط "عرض الزيارات" بلوحة الـ KPI — يفلتر لزيارات مستشار واحد بس
  // ويبين بانر يأكد مين اللي معروض، مع رابط رجوع لكل السجلات
  it('filters to one counselor via ?counselor=, and can show everyone again', async () => {
    searchParams = new URLSearchParams('counselor=c1')
    renderVisitsPanel()

    await screen.findByText('Fictional Student R')
    expect(screen.getByText(/Showing Fictional Student K's visits/)).toBeInTheDocument()
    expect(screen.queryByText('Demo Student One')).not.toBeInTheDocument()

    expect(screen.getByText('Show all records')).toHaveAttribute('href', '/admin/visits')
  })

  // يجي من صف "— unassigned —" بلوحة الـ KPI — يفلتر للزيارات اللي ما لها
  // مستشار (counselorId = null) بس، عكس الفلترة العادية بمعرّف مستشار حقيقي
  it('filters to unassigned visits via ?counselor=unassigned', async () => {
    searchParams = new URLSearchParams('counselor=unassigned')
    renderVisitsPanel()

    await screen.findByText('Demo Student One')
    expect(screen.getByText(/Showing unassigned visits/)).toBeInTheDocument()
    expect(screen.queryByText('Fictional Student R')).not.toBeInTheDocument()

    expect(screen.getByText('Show all records')).toHaveAttribute('href', '/admin/visits')
  })

  it('shows the overdue follow-up badge next to the status pill', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total')) {
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      }
      if (url.startsWith('/api/admin/visits')) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              ...visitsList()[0],
              studentStatus: 'follow_up_needed',
              status: 'closed',
              followUpDueAt: '2020-01-01T00:00:00.000Z',
            },
          ],
        }) as any
      }
      if (url === '/api/counselors/all') {
        return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
      }
      if (url === '/api/counselors/active') {
        return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
      }
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    const row = screen.getByText('Demo Student One').closest('tr')!
    expect(within(row).getByText(/Overdue/)).toBeInTheDocument()
  })

  describe('paging', () => {
    // visit-001 هو الأحدث (نرتب بالتاريخ تنازلياً افتراضياً)
    function manyVisits(count: number) {
      return Array.from({ length: count }, (_, i) => ({
        ...visitsList()[0],
        id: `v${i + 1}`,
        name: `Client ${String(i + 1).padStart(3, '0')}`,
        phone: `05000${String(i + 1).padStart(5, '0')}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, count - i)).toISOString(),
      }))
    }

    function mockFetchWith(visits: unknown[]) {
      global.fetch = vi.fn((url: string) => {
        if (url.startsWith('/api/admin/visits/total')) {
          return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
        }
        if (url.startsWith('/api/admin/visits')) {
          return Promise.resolve({ ok: true, json: async () => visits }) as any
        }
        if (url === '/api/counselors/active' || url === '/api/counselors/all') {
          return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
        }
        return Promise.resolve({ ok: true, json: async () => [] }) as any
      }) as any
    }

    const bodyRows = () => screen.getAllByRole('row').slice(1)

    it('shows 20 rows per page by default, with the range and page buttons', async () => {
      mockFetchWith(manyVisits(45))
      renderVisitsPanel()
      await screen.findByText('Client 001')

      expect(bodyRows()).toHaveLength(20)
      expect(screen.getByText(new RegExp('Showing 1–20 of 45 visits'))).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true')
      const pager = screen.getByRole('navigation', { name: 'Pages' })
      expect(within(pager).getByRole('button', { name: 'Page 3' })).toBeInTheDocument()
      expect(within(pager).getByRole('button', { name: '‹ Prev' })).toBeDisabled()
    })

    it('changes the rows per page, goes back to page 1, and remembers the choice', async () => {
      mockFetchWith(manyVisits(45))
      renderVisitsPanel()
      await screen.findByText('Client 001')

      fireEvent.click(
        within(screen.getByRole('navigation')).getByRole('button', { name: 'Page 2' })
      )
      expect(screen.getByText(new RegExp('Showing 21–40 of 45 visits'))).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: '10' }))
      expect(bodyRows()).toHaveLength(10)
      expect(screen.getByText(new RegExp('Showing 1–10 of 45 visits'))).toBeInTheDocument()
      expect(localStorage.getItem('visits-page-size')).toBe('10')

      fireEvent.click(screen.getByRole('button', { name: '100' }))
      expect(bodyRows()).toHaveLength(45)
      // كل الزيارات بصفحة وحدة — ما نعرض أزرار صفحات
      expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
    })

    it('starts from the remembered page size', async () => {
      localStorage.setItem('visits-page-size', '50')
      mockFetchWith(manyVisits(60))
      renderVisitsPanel()
      await screen.findByText('Client 001')
      await waitFor(() => expect(bodyRows()).toHaveLength(50))
      expect(screen.getByRole('button', { name: '50' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('ignores a corrupted remembered page size', async () => {
      localStorage.setItem('visits-page-size', 'lots')
      mockFetchWith(manyVisits(30))
      renderVisitsPanel()
      await screen.findByText('Client 001')
      expect(bodyRows()).toHaveLength(20)
    })

    it('moves with Next and Prev and shows the right rows on each page', async () => {
      mockFetchWith(manyVisits(45))
      renderVisitsPanel()
      await screen.findByText('Client 001')

      fireEvent.click(screen.getByRole('button', { name: 'Next ›' }))
      expect(screen.getByText('Client 021')).toBeInTheDocument()
      expect(screen.queryByText('Client 001')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
      expect(screen.getByText(new RegExp('Showing 41–45 of 45 visits'))).toBeInTheDocument()
      expect(bodyRows()).toHaveLength(5)
      expect(screen.getByRole('button', { name: 'Next ›' })).toBeDisabled()

      fireEvent.click(screen.getByRole('button', { name: '‹ Prev' }))
      expect(screen.getByText(new RegExp('Showing 21–40 of 45 visits'))).toBeInTheDocument()
    })

    it('goes back to page 1 when the sort changes, and sorts the whole list before cutting pages', async () => {
      mockFetchWith(manyVisits(45))
      renderVisitsPanel()
      await screen.findByText('Client 001')

      fireEvent.click(screen.getByRole('button', { name: 'Page 3' }))
      fireEvent.click(screen.getByRole('button', { name: /^Name/ }))
      expect(screen.getByText(new RegExp('Showing 1–20 of 45 visits'))).toBeInTheDocument()
      // ترتيب الاسم تصاعدي على كل القائمة: أول صفحة تبدأ بـ Client 001
      expect(within(bodyRows()[0]).getAllByRole('cell')[0]).toHaveTextContent('Client 001')
    })

    it('counts only the filtered visits when a counselor filter is active', async () => {
      const visits = manyVisits(30).map((v, i) => ({ ...v, counselorId: i < 12 ? 'c1' : null }))
      mockFetchWith(visits)
      searchParams = new URLSearchParams('counselor=c1')
      renderVisitsPanel()
      await screen.findByText('Client 001')
      expect(screen.getByText(new RegExp('Showing 1–12 of 12 visits'))).toBeInTheDocument()
      expect(bodyRows()).toHaveLength(12)
    })

    it('shows 0–0 of 0 and no pager for an empty list', async () => {
      mockFetchWith([])
      renderVisitsPanel()
      expect(await screen.findByText(new RegExp('Showing 0–0 of 0 visits'))).toBeInTheDocument()
      expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
    })
  })

  describe('date range and all-time search', () => {
    let calledUrls: string[]

    function mockWith(visits: unknown[], total = 269) {
      calledUrls = []
      global.fetch = vi.fn((url: string) => {
        calledUrls.push(url)
        if (url.startsWith('/api/admin/visits/total'))
          return Promise.resolve({ ok: true, json: async () => ({ total }) }) as any
        if (url.startsWith('/api/admin/visits'))
          return Promise.resolve({ ok: true, json: async () => visits }) as any
        if (url === '/api/counselors/all')
          return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
        if (url === '/api/counselors/active')
          return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
        return Promise.resolve({ ok: true, json: async () => [] }) as any
      }) as any
    }

    const visitsUrl = () =>
      calledUrls.filter((u) => u.startsWith('/api/admin/visits?')).at(-1) ?? ''
    const param = (name: string) => new URL(visitsUrl(), 'http://localhost').searchParams.get(name)

    it('loads the last 7 days by default, cut at Kuwait midnight', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')

      const from = new Date(param('from')!)
      const to = new Date(param('to')!)
      expect(Math.round((to.getTime() - from.getTime()) / 86400000)).toBe(8)
      // منتصف الليل بالكويت = 21:00 UTC
      expect(from.getUTCHours()).toBe(21)
      expect(param('q')).toBeNull()
    })

    it('names the period and the all-time total, so the count cannot read as everything', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')
      expect(screen.getByText(/Showing 1–2 of 2 visits ·/)).toHaveTextContent('269 all time')
    })

    it('reloads with a wider range when a preset is picked', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')

      fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'year' } })

      await waitFor(() => expect(new Date(param('from')!).getUTCMonth()).toBe(11))
      // أول السنة بتوقيت الكويت = 21:00 من 31 ديسمبر السابق
      expect(new Date(param('from')!).getUTCDate()).toBe(31)
    })

    it('reloads when a date is typed by hand', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')

      fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-01-05' } })

      await waitFor(() => expect(param('from')).toBe('2026-01-04T21:00:00.000Z'))
    })

    it('searches all time and ignores the dates, greying them out', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')

      fireEvent.change(screen.getByLabelText('Search all visits'), { target: { value: 'ahmad' } })

      await waitFor(() => expect(visitsUrl()).toContain('q=ahmad'))
      expect(new URL(visitsUrl(), 'http://localhost').searchParams.get('from')).toBeNull()
      expect(screen.getByLabelText('From')).toBeDisabled()
      expect(screen.getByLabelText('Range')).toBeDisabled()
      expect(screen.getByText(/2 visits match “ahmad” · all time/)).toBeInTheDocument()
    })

    it('sends an Arabic search through untouched, for the server to normalise', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')

      fireEvent.change(screen.getByLabelText('Search all visits'), { target: { value: 'أحمد' } })

      await waitFor(() => expect(param('q')).toBe('أحمد'))
    })

    it('clears the search and returns to the date range', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      await screen.findByText('Demo Student One')
      fireEvent.change(screen.getByLabelText('Search all visits'), { target: { value: 'ahmad' } })
      await waitFor(() => expect(visitsUrl()).toContain('q=ahmad'))

      fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))

      await waitFor(() => expect(param('q')).toBeNull())
      expect(param('from')).not.toBeNull()
      expect(screen.getByLabelText('From')).not.toBeDisabled()
      expect(screen.getByText(/Showing 1–2 of 2 visits ·/)).toBeInTheDocument()
    })

    it('explains an empty search result, including the 8-digit rule', async () => {
      mockWith([])
      renderVisitsPanel()
      fireEvent.change(screen.getByLabelText('Search all visits'), { target: { value: 'zzz' } })

      expect(await screen.findByText(/No visit matches “zzz”/)).toBeInTheDocument()
      expect(screen.getByText('For a phone number, type all 8 digits.')).toBeInTheDocument()
    })

    // السقف يقطع بصمت لولا هذا السطر: موظفة تدوّر "محمد" وتلقى النتائج
    // ناقصة بلا إشارة، فتستنتج إن العميل مو مسجّل أصلاً
    it('says so when the search hit the ceiling and was cut', async () => {
      calledUrls = []
      global.fetch = vi.fn((url: string) => {
        calledUrls.push(url)
        if (url.startsWith('/api/admin/visits/total'))
          return Promise.resolve({ ok: true, json: async () => ({ total: 900 }) }) as any
        if (url.startsWith('/api/admin/visits'))
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'x-search-truncated': 'true' }),
            json: async () => visitsList(),
          }) as any
        if (url === '/api/counselors/all')
          return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
        if (url === '/api/counselors/active')
          return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
        return Promise.resolve({ ok: true, json: async () => [] }) as any
      }) as any

      renderVisitsPanel()
      fireEvent.change(screen.getByLabelText('Search all visits'), {
        target: { value: 'mohammed' },
      })

      expect(
        await screen.findByText('More than 500 matches — narrow your search.')
      ).toBeInTheDocument()
    })

    it('stays quiet when the search fits inside the ceiling', async () => {
      mockWith(visitsList())
      renderVisitsPanel()
      fireEvent.change(screen.getByLabelText('Search all visits'), {
        target: { value: 'mohammed' },
      })

      await waitFor(() => expect(visitsUrl()).toContain('q=mohammed'))
      expect(screen.queryByText(/narrow your search/)).not.toBeInTheDocument()
    })

    it('does not show the empty-search message when the date range is simply empty', async () => {
      mockWith([])
      renderVisitsPanel()
      await waitFor(() => expect(visitsUrl()).toContain('from='))
      expect(screen.queryByText(/No visit matches/)).not.toBeInTheDocument()
    })

    it('keeps working when the all-time total cannot be loaded', async () => {
      mockWith(visitsList())
      global.fetch = vi.fn((url: string) => {
        if (url.startsWith('/api/admin/visits/total'))
          return Promise.resolve({ ok: false, json: async () => ({}) }) as any
        if (url.startsWith('/api/admin/visits'))
          return Promise.resolve({ ok: true, json: async () => visitsList() }) as any
        return Promise.resolve({ ok: true, json: async () => [] }) as any
      }) as any

      renderVisitsPanel()
      await screen.findByText('Demo Student One')
      expect(screen.getByText(/Showing 1–2 of 2 visits ·/)).toBeInTheDocument()
    })
  })

  // القوائم فاضية عمدًا: الاسم لازم يجي من الصف نفسه، مو من أي قائمة بالواجهة
  it('names an assigned counselor from the row, with no counselor list loaded at all', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total'))
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      if (url.startsWith('/api/admin/visits'))
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              ...visitsList()[0],
              counselorId: 'c2',
              counselorName: 'Off Shift Counselor',
              counselorNameAr: null,
            },
          ],
        }) as any
      return Promise.resolve({ ok: false, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    expect(screen.getByText('Off Shift Counselor')).toBeInTheDocument()
    expect(screen.queryByText('c2')).not.toBeInTheDocument()
  })

  // رابط الجرس: لازم الصفحة تسأل السيرفر بنفس الفلتر، وبدون تواريخ أبداً —
  // وإلا وصلت على قائمة آخر ٧ أيام وأنت تتوقع ٧٨ عميل
  it('asks for the notification bucket with no date range at all', async () => {
    searchParams = new URLSearchParams('waiting=absent')
    const calls: string[] = []
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total'))
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      if (url.startsWith('/api/admin/visits')) {
        calls.push(url)
        return Promise.resolve({ ok: true, json: async () => [visitsList()[1]] }) as any
      }
      if (url === '/api/counselors/all')
        return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Fictional Student R')

    expect(calls).toContain('/api/admin/visits?waiting=absent')
    expect(calls.some((url) => url.includes('from='))).toBe(false)
    expect(
      screen.getByText('Showing the clients counted in notifications — all dates, no 7-day limit.')
    ).toBeInTheDocument()
    expect(screen.getByText('Show all records')).toHaveAttribute('href', '/admin/visits')
  })

  // المستشار يستلم عملاء عادي، بس ما فتح التطبيق اليوم — المشرف لازم يشوفها
  // من الجدول بدون ما يفتح أي صف
  it('counts the working days a counselor has been quiet, and says nothing when they are here', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total'))
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      if (url.startsWith('/api/admin/visits'))
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              ...visitsList()[1],
              id: 'away',
              name: 'Waiting On Someone Away',
              counselorSignedInToday: false,
              counselorQuietWorkingDays: 3,
            },
            visitsList()[1],
          ],
        }) as any
      if (url === '/api/counselors/all')
        return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Waiting On Someone Away')

    const flagged = screen.getByText('Waiting On Someone Away').closest('tr')!
    expect(within(flagged).getByText('Not in for 3 working days')).toBeInTheDocument()
    // زر الإلغاء لازم يكون بنفس سطر الاسم، مو بسطر ثالث بعيد عنه
    const line = within(flagged).getByText('Fictional Student K').closest('.counselor-line')!
    expect(within(line as HTMLElement).getByTitle('Unassign')).toBeInTheDocument()

    const clear = screen.getByText('Fictional Student R').closest('tr')!
    expect(within(clear).queryByText(/Not in for/)).not.toBeInTheDocument()
  })

  // زيارة انتهت: ما عاد أحد ينتظر، فحضور المستشار اليوم ما له علاقة بها
  it('keeps the caption off a finished visit, even when the counselor is away', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total'))
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      if (url.startsWith('/api/admin/visits'))
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              ...visitsList()[1],
              id: 'done',
              name: 'Finished Client',
              status: 'closed',
              studentStatus: 'closed',
              closedAt: '2026-09-17T10:00:00.000Z',
              counselorSignedInToday: false,
              counselorQuietWorkingDays: 1,
            },
            {
              ...visitsList()[1],
              id: 'open',
              name: 'Still Waiting Client',
              counselorSignedInToday: false,
              counselorQuietWorkingDays: 1,
            },
          ],
        }) as any
      if (url === '/api/counselors/all')
        return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Finished Client')

    const finished = screen.getByText('Finished Client').closest('tr')!
    expect(within(finished).queryByText(/Not in for/)).not.toBeInTheDocument()

    const open = screen.getByText('Still Waiting Client').closest('tr')!
    expect(within(open).getByText('Not in for 1 working day')).toBeInTheDocument()
  })

  // غير معيّن ما يعني "ما سجّل دخول" — لازم تفرق null عن false
  it('does not flag a row that has no counselor at all', async () => {
    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    const unassigned = screen.getByText('Demo Student One').closest('tr')!
    expect(within(unassigned).queryByText(/Not in for/)).not.toBeInTheDocument()
  })

  // المستخدم انحذف أو تغيّر دوره: ما عندنا اسم، بس المعرّف الخام أسوأ من لا شيء
  it('says "Unknown counselor" rather than printing a raw id', async () => {
    global.fetch = vi.fn((url: string) => {
      if (url.startsWith('/api/admin/visits/total'))
        return Promise.resolve({ ok: true, json: async () => ({ total: 269 }) }) as any
      if (url.startsWith('/api/admin/visits'))
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              ...visitsList()[0],
              counselorId: 'deleted-user-id',
              counselorName: null,
              counselorNameAr: null,
            },
          ],
        }) as any
      if (url === '/api/counselors/all')
        return Promise.resolve({ ok: true, json: async () => allCounselorsList() }) as any
      if (url === '/api/counselors/active')
        return Promise.resolve({ ok: true, json: async () => counselorsList() }) as any
      return Promise.resolve({ ok: true, json: async () => [] }) as any
    }) as any

    renderVisitsPanel()
    await screen.findByText('Demo Student One')

    expect(screen.getByText('Unknown counselor')).toBeInTheDocument()
    expect(screen.queryByText('deleted-user-id')).not.toBeInTheDocument()
  })
})
describe('VisitsPanel unassign button', () => {
  beforeEach(() => {
    global.fetch = mockFetchDefault() as any
    searchParams = new URLSearchParams()
    localStorage.clear()
  })

  // الاسم الوحيد للزر كان tooltip — قارئ الشاشة يقول "multiplication x"
  it('names the ✕ after the counselor it removes, and still unassigns', async () => {
    renderVisitsPanel()
    await screen.findByText('Fictional Student R')
    const row = screen.getByText('Fictional Student R').closest('tr')!

    fireEvent.click(within(row).getByRole('button', { name: 'Unassign Fictional Student K' }))

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/admin/reassign',
        expect.objectContaining({ body: JSON.stringify({ visitId: 'v2', counselorId: null }) })
      )
    )
  })

  it('names the ✕ on an application row too', async () => {
    const base = mockFetchDefault()
    global.fetch = vi.fn((url: string, init?: RequestInit) =>
      url.startsWith('/api/applications/kind/visa')
        ? Promise.resolve({
            ok: true,
            json: async () => [
              {
                id: 'app-1',
                kind: 'visa',
                name: 'Fictional Student H',
                phone: '50000009',
                counselorId: 'c1',
                counselorName: 'Fictional Student D',
                counselorNameAr: null,
                counselorSignedInToday: true,
                counselorQuietWorkingDays: 0,
                counselorShift: null,
                status: 'pending',
                createdAt: new Date().toISOString(),
                acceptedAt: null,
                closedAt: null,
              },
            ],
          })
        : base(url, init)
    ) as any

    renderVisitsPanel()
    await screen.findByText('Fictional Student H')
    const row = screen.getByText('Fictional Student H').closest('tr')!
    expect(
      within(row).getByRole('button', { name: 'Unassign Fictional Student D' })
    ).toBeInTheDocument()
  })

  it('names the ✕ in Arabic', async () => {
    document.cookie = 'app-language=ar; path=/'
    try {
      renderVisitsPanel()
      await screen.findByText('Fictional Student R')
      const row = screen.getByText('Fictional Student R').closest('tr')!
      expect(within(row).getByRole('button', { name: /^إلغاء تعيين / })).toBeInTheDocument()
    } finally {
      document.cookie = 'app-language=; path=/; max-age=0'
    }
  })
})

describe('VisitsPanel delete confirmation as a dialog', () => {
  beforeEach(() => {
    global.fetch = mockFetchDefault() as any
    searchParams = new URLSearchParams()
    localStorage.clear()
  })

  // من زر الحذف بالصف، Tab كان يمشي على كل الصفوف تحته قبل ما يوصل "إلغاء"
  it('opens as a dialog with focus on Cancel, never Delete', async () => {
    renderVisitsPanel()
    await screen.findByText('Fictional Student R')
    const row = screen.getByText('Fictional Student R').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete "Fictional Student R"?' })
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  it("closes on Escape without deleting, and returns focus to the row's Delete", async () => {
    renderVisitsPanel()
    await screen.findByText('Fictional Student R')
    const row = screen.getByText('Fictional Student R').closest('tr')!
    const rowDelete = within(row).getByRole('button', { name: 'Delete' })
    rowDelete.focus()
    fireEvent.click(rowDelete)
    screen.getByRole('dialog', { name: 'Delete "Fictional Student R"?' })

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(rowDelete).toHaveFocus()
    expect(
      (global.fetch as any).mock.calls.some(
        ([, init]: [string, RequestInit | undefined]) => init?.method === 'DELETE'
      )
    ).toBe(false)
  })
})

describe('VisitsPanel long note', () => {
  beforeEach(() => {
    searchParams = new URLSearchParams()
    localStorage.clear()
    const base = mockFetchDefault()
    global.fetch = vi.fn((url: string, init?: RequestInit) =>
      url.startsWith('/api/admin/visits?') || url === '/api/admin/visits'
        ? Promise.resolve({
            ok: true,
            json: async () => [
              {
                ...visitsList()[0],
                note: 'Asked about IELTS dates for November and a payment plan',
              },
            ],
          })
        : base(url, init)
    ) as any
  })

  // كان div ينضغط بالماوس بس: الملاحظة المقصوصة ما تنقرا كاملة بالكيبورد
  it('is a real button that says whether the note is expanded', async () => {
    renderVisitsPanel()
    const note = await screen.findByRole('button', { name: /Asked about IELTS dates/ })
    expect(note).toHaveAttribute('aria-expanded', 'false')
    expect(note).toHaveTextContent('more')

    fireEvent.click(note)

    expect(note).toHaveAttribute('aria-expanded', 'true')
    expect(note).toHaveTextContent('less')
  })
})
