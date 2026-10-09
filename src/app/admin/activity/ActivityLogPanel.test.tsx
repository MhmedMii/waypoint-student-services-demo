import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../../i18n/LanguageContext'
import { ActivityLogPanel } from './ActivityLogPanel'
import type { ActivityLogRow } from './activityLogView'

// ظهر اليوم وظهر أمس — ثابتين مهما كانت ساعة تشغيل الاختبار، فما يصير flaky قرب منتصف الليل
function noonToday(): Date {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  return date
}
function hoursBefore(base: Date, hours: number): string {
  return new Date(base.getTime() - hours * 60 * 60 * 1000).toISOString()
}

const TODAY = noonToday()

function row(overrides: Partial<ActivityLogRow> = {}): ActivityLogRow {
  return {
    id: Math.random().toString(36).slice(2),
    actorId: 'u1',
    actorName: 'Dev Admin',
    actorNameAr: null,
    actorRole: 'super_admin',
    action: 'visit_closed',
    targetType: 'visit',
    targetId: 'v1',
    details: 'Closed visit for Fictional Student G',
    detailsAr: 'تم إغلاق الزيارة لـ ليلى حداد',
    createdAt: hoursBefore(TODAY, 1),
    ...overrides,
  }
}

function mockLogs(rows: ActivityLogRow[], totals?: { inRange?: number; allTime?: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rows,
        totalInRange: totals?.inRange ?? rows.length,
        totalAllTime: totals?.allTime ?? rows.length,
      }),
    })
  )
}

function renderPanel(role: 'admin' | 'super_admin' = 'super_admin') {
  return render(
    <LanguageProvider>
      <ActivityLogPanel role={role} />
    </LanguageProvider>
  )
}

// نحصر البحث داخل القائمة — الـ<select> الخاص بالفلاتر فيه <option> أصلية
// وتطلع بنفس الـrole لو بحثنا على مستوى الصفحة كلها
function feedOptions() {
  return within(screen.getByRole('listbox')).getAllByRole('option')
}

describe('ActivityLogPanel', () => {
  beforeEach(() => {
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists every event, one row each, grouped by day', async () => {
    mockLogs([
      row({ action: 'visit_closed' }),
      row({ action: 'account_promoted', targetType: 'account' }),
      row({ action: 'application_deleted', targetType: 'application' }),
      row({ action: 'visit_closed', createdAt: hoursBefore(TODAY, 30) }),
    ])
    renderPanel()

    expect(await screen.findByRole('listbox')).toBeInTheDocument()
    expect(feedOptions()).toHaveLength(4)
  })

  it('never bundles a run of the same actor and action, even 3+ in a row', async () => {
    mockLogs([row(), row(), row(), row({ action: 'visit_reassigned' })])
    renderPanel()

    await screen.findByRole('listbox')
    expect(feedOptions()).toHaveLength(4)
    expect(screen.queryByText(/×3/)).not.toBeInTheDocument()
  })

  it('filters the feed by severity', async () => {
    mockLogs([
      row({ action: 'visit_closed' }),
      row({ action: 'visit_closed' }),
      row({ action: 'account_deleted', targetType: 'account' }),
    ])
    renderPanel()

    await screen.findByRole('listbox')
    expect(feedOptions()).toHaveLength(3)

    fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'destructive' } })

    const options = feedOptions()
    expect(options).toHaveLength(1)
    expect(within(options[0]).getByText(/Account deleted/)).toBeInTheDocument()
  })

  it('shows the Arabic actor name in the filter dropdown, but still filters correctly', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockLogs([
      row({ actorName: 'Demo Counselor Five', actorNameAr: 'مستشار تجريبي خامس' }),
      row({
        actorName: 'Demo Counselor Two',
        actorNameAr: 'مستشار تجريبي ثان',
        action: 'account_deleted',
        targetType: 'account',
      }),
    ])
    renderPanel()
    await screen.findByRole('listbox')

    const select = screen.getByLabelText('المستخدم')
    expect(within(select).getByText('مستشار تجريبي خامس')).toBeInTheDocument()
    expect(within(select).queryByText('Demo Counselor Five')).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'Demo Counselor Five' } })
    const options = feedOptions()
    expect(options).toHaveLength(1)
    expect(within(options[0]).getByText('مستشار تجريبي خامس')).toBeInTheDocument()
    document.cookie = 'app-language=; path=/; max-age=0'
  })

  it('says the request failed instead of claiming there is no activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ ok: false }) })
    )
    renderPanel()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/Couldn/)).toBeInTheDocument()
    expect(screen.queryByText('No activity yet.')).not.toBeInTheDocument()
  })

  it('shows the empty state only when the log is genuinely empty', async () => {
    mockLogs([])
    renderPanel()
    expect(await screen.findByText('No activity yet.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('opens the full event details page when a row is clicked', async () => {
    mockLogs([row({ details: 'Closed visit for Fictional Student O' })])
    renderPanel()

    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])

    expect(screen.getByText('Recorded detail')).toBeInTheDocument()
    expect(screen.getByText('Closed visit for Fictional Student O')).toBeInTheDocument()
    // القائمة اختفت والتفاصيل حلّت محلها — مو عمود جانبي ثابت
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('goes back to the list from the detail page', async () => {
    mockLogs([row()])
    renderPanel()

    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])
    expect(screen.getByText('Recorded detail')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Back to activity log/i })[0])
    expect(await screen.findByRole('listbox')).toBeInTheDocument()
  })

  it('moves the roving focus with the arrow keys without opening the detail page', async () => {
    mockLogs([row({ action: 'visit_closed' }), row({ action: 'visit_reassigned' })])
    renderPanel()

    await screen.findByRole('listbox')
    const listbox = screen.getByRole('listbox')

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(feedOptions()[0]).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Recorded detail')).not.toBeInTheDocument()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(feedOptions()[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(listbox, { key: 'ArrowUp' })
    expect(feedOptions()[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(listbox, { key: 'Enter' })
    expect(screen.getByText('Recorded detail')).toBeInTheDocument()
  })

  it('distinguishes a filtered-empty result from an empty log', async () => {
    mockLogs([row({ actorName: 'Dev Admin' })])
    renderPanel()

    await screen.findByRole('listbox')
    fireEvent.change(screen.getByPlaceholderText(/Search actor/), {
      target: { value: 'nobody-by-this-name' },
    })

    expect(screen.getByText('No events match these filters')).toBeInTheDocument()
    expect(screen.queryByText('No activity yet.')).not.toBeInTheDocument()
  })

  it('shows a translated label for self-service rows, not the stored English name', async () => {
    mockLogs([
      row({
        actorId: null,
        actorName: 'Self-service',
        actorRole: 'system',
        action: 'visit_created',
      }),
    ])
    renderPanel()

    expect(await screen.findByText(/Self-service \(kiosk or online form\)/)).toBeInTheDocument()
  })

  // نفس علة الاسم الإنجليزي اللي كانت بـ OnlineNowPanel — اكتشفها المستخدم
  // فعليًا بالإنتاج بعد نشر باقي إصلاحات سجل النشاط
  it('shows the actor Arabic name instead of the stored English one, in Arabic mode', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockLogs([
      row({
        actorName: 'Demo Counselor Five',
        actorNameAr: 'مستشار تجريبي خامس',
        actorRole: 'counselor',
      }),
    ])
    renderPanel()

    // فلتر "المستخدم" فيه <option> بالاسم الإنجليزي الخام دايمًا (قائمة منفصلة
    // ما لمسناها هنا) — نحصر التحقق بسطر الحدث نفسه (<b>) بدل الصفحة كلها
    expect(await screen.findByText('مستشار تجريبي خامس', { selector: 'b' })).toBeInTheDocument()
    expect(screen.queryByText('Demo Counselor Five', { selector: 'b' })).not.toBeInTheDocument()
    document.cookie = 'app-language=; path=/; max-age=0'
  })

  it('falls back to the English actor name when no Arabic name is stored', async () => {
    document.cookie = 'app-language=ar; path=/'
    mockLogs([row({ actorName: 'Demo Counselor Five', actorNameAr: null, actorRole: 'counselor' })])
    renderPanel()

    expect(await screen.findByText('Demo Counselor Five', { selector: 'b' })).toBeInTheDocument()
    document.cookie = 'app-language=; path=/; max-age=0'
  })

  it('links a visit target to that exact record, not a bare list', async () => {
    mockLogs([row({ action: 'visit_closed', targetType: 'visit', targetId: 'v-123' })])
    renderPanel()
    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])

    const link = screen.getByRole('link', { name: /Open record/i })
    expect(link).toHaveAttribute('href', '/admin/visits?focus=v-123')
  })

  // كان الرابط يودّي لقائمة عامة حتى لو الهدف انحذف — ما فيه شي نفتحه
  it('shows text instead of a dead link when the target was deleted', async () => {
    mockLogs([row({ action: 'application_deleted', targetType: 'application', targetId: 'a-9' })])
    renderPanel()
    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])

    expect(screen.queryByRole('link', { name: /Open record/i })).not.toBeInTheDocument()
    expect(screen.getByText(/This record was deleted/i)).toBeInTheDocument()
  })

  // صفحة الحسابات محصورة على super_admin — الرابط للأدمن العادي كان يرجّعه بصمت
  it('hides the account link from an admin who cannot open that page', async () => {
    mockLogs([row({ action: 'account_promoted', targetType: 'account', targetId: 'u-7' })])
    renderPanel('admin')
    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])

    expect(screen.queryByRole('link', { name: /Open record/i })).not.toBeInTheDocument()
  })

  it('links an account target for a super_admin', async () => {
    mockLogs([row({ action: 'account_promoted', targetType: 'account', targetId: 'u-7' })])
    renderPanel('super_admin')
    await screen.findByRole('listbox')
    fireEvent.click(feedOptions()[0])

    expect(screen.getByRole('link', { name: /Open record/i })).toHaveAttribute(
      'href',
      '/admin/accounts?focus=u-7'
    )
  })

  it('offers the export link, carrying the period on screen', async () => {
    mockLogs([row()])
    renderPanel()
    const link = await screen.findByRole('link', { name: 'Export this period' })
    expect(link).toHaveAttribute('href', '/api/admin/activity-logs/export?lang=en&days=all')
  })

  // التصدير كان يتجاهل الفترة: "آخر ٧ أيام" على الشاشة و"آخر ٢٠٠" بالملف
  it('changes the export to the new period when the period changes', async () => {
    mockLogs([row()])
    renderPanel()
    await screen.findByRole('link', { name: 'Export this period' })

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '7' } })

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Export this period' })).toHaveAttribute(
        'href',
        '/api/admin/activity-logs/export?lang=en&days=7'
      )
    )
  })

  it('shows the other events on the same target in the detail page, oldest first', async () => {
    mockLogs([
      row({ id: 'a', targetId: 'v-42', action: 'visit_created', createdAt: hoursBefore(TODAY, 3) }),
      row({
        id: 'b',
        targetId: 'v-42',
        action: 'visit_reassigned',
        createdAt: hoursBefore(TODAY, 2),
      }),
      row({ id: 'c', targetId: 'v-42', action: 'visit_closed', createdAt: hoursBefore(TODAY, 1) }),
    ])
    renderPanel()
    await screen.findByRole('listbox')

    // نختار الحدث الأخير (الأحدث بالقائمة، مرتّبة تنازلي)
    fireEvent.click(feedOptions()[0])

    expect(screen.getByText('Other activity on this record')).toBeInTheDocument()
    const timeline = screen.getByText('Other activity on this record').parentElement!
    const entries = within(timeline).getAllByText(/Visit /)
    expect(entries[0]).toHaveTextContent('Visit created')
    expect(entries[entries.length - 1]).toHaveTextContent('Visit closed')
  })
})

describe('ActivityLogPanel: the log no longer hides how much it holds', () => {
  const calls = () =>
    (global.fetch as any).mock.calls.map((c: unknown[]) => String(c[0])) as string[]

  it('says what period it is showing, and how much exists outside it', async () => {
    mockLogs([row()], { inRange: 1876, allTime: 1876 })
    renderPanel()
    await screen.findByRole('listbox')

    // "200 / 200" كانت تنقرأ كأنها السجل كامل
    expect(screen.getByText(/1 of 1876 events · all time · 1876 all time/)).toBeInTheDocument()
    expect(screen.queryByText(/^\d+ \/ \d+ events shown$/)).not.toBeInTheDocument()
  })

  it('names the chosen period, so a 30-day view cannot pass for the whole log', async () => {
    mockLogs([row()], { inRange: 412, allTime: 1876 })
    renderPanel()
    await screen.findByRole('listbox')

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '30' } })

    expect(
      await screen.findByText(/1 of 412 events · last 30 days · 1876 all time/)
    ).toBeInTheDocument()
  })

  it('asks the server again when the period changes, instead of filtering what it already has', async () => {
    mockLogs([row()], { inRange: 10, allTime: 1876 })
    renderPanel()
    await screen.findByRole('listbox')
    expect(calls().some((url) => url.includes('days=all'))).toBe(true)

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '30' } })

    await waitFor(() => expect(calls().some((url) => url.includes('days=30'))).toBe(true))
  })
})

// العميل اختار مستشاره بنفسه من الكشك — الصف يسجّل الاختيار، والأحمر يقع
// على عدد الأيام بس، مو على الجملة كلها ولا على اسم الإجراء
describe('a client choosing a counselor who has not been in', () => {
  const absentRow = row({
    action: 'follow_up_absent_counselor',
    details: 'Sample Client chose Demo Counselor One — not in 15 working days',
    detailsAr: 'عميل تجريبي اختار مستشار تجريبي أول — ما حضر من 15 يوم عمل',
  })

  it('reddens only the day count, leaving the rest of the sentence alone', async () => {
    mockLogs([absentRow])
    renderPanel()
    await screen.findByText('Absent counselor chosen')

    const red = document.querySelector('.activity-detail-absent')!
    expect(red).not.toBeNull()
    expect(red.textContent).toBe('not in 15 working days')

    // اسم الإجراء يبقى بلون السطر العادي
    expect(
      screen.getByText('Absent counselor chosen').closest('.activity-detail-absent')
    ).toBeNull()
    expect(document.querySelector('.activity-row-dot.absent-choice')).not.toBeNull()
  })

  it('leaves the quieter case with no red at all', async () => {
    mockLogs([
      row({
        action: 'follow_up_counselor_not_in',
        details: 'Sample Client chose Demo Counselor Five — not in for 1 working day',
        detailsAr: 'عميل تجريبي اختار فاي فرج — ما حضر من يوم عمل',
      }),
    ])
    renderPanel()
    await screen.findByText('Counselor not in today')

    expect(document.querySelector('.activity-detail-absent')).toBeNull()
    expect(document.querySelector('.activity-row-dot.absent-choice')).toBeNull()
  })

  // أسوأ حالة: سطر بدون الفاصل — يتعرض كامل بدل ما ينكسر الصف
  it('renders a detail with no separator whole, rather than breaking', async () => {
    mockLogs([
      row({
        action: 'follow_up_absent_counselor',
        details: 'a line written before the separator existed',
        detailsAr: null,
      }),
    ])
    renderPanel()
    await screen.findByText('a line written before the separator existed')
    expect(document.querySelector('.activity-detail-absent')).toBeNull()
  })
})

// عميل وصل وراح بدون مستشار — كان مدفون كنص رمادي بآخر سطر "إنشاء زيارة"
describe('a client left with nobody', () => {
  it('gets its own red row, not grey text at the end of another line', async () => {
    mockLogs([
      row({
        action: 'visit_left_unassigned',
        details: 'Othman alhsban — nobody on shift has been in for 5 working days',
        detailsAr: 'عثمان الحصبان — ما فيه أحد بالشفت حضر من 5 أيام عمل',
      }),
    ])
    renderPanel()
    await screen.findByText('Client left unassigned')

    const red = document.querySelector('.activity-detail-absent')!
    expect(red.textContent).toBe('nobody on shift has been in for 5 working days')
    expect(document.querySelector('.activity-row-dot.absent-choice')).not.toBeNull()
  })

  it('leaves an ordinary visit_created row entirely grey', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details: 'Created new-client visit for Demo Student One — USA',
        detailsAr: null,
      }),
    ])
    renderPanel()
    await screen.findByText('Created new-client visit for Demo Student One — USA')
    expect(document.querySelector('.activity-detail-absent')).toBeNull()
  })
})

// الصفوف اللي بالسجل الحين انكتبت قبل ما يصير لهالحالة إجراء خاص. ما نعيد
// كتابتها — نلوّنها وقت العرض، فالمشرف يشوف الحمرا على اللي صار أمس كمان
describe('rows written before the new action existed', () => {
  it('reddens the reason inside an old Visit created row', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details:
          'Created new-client visit for Sample Client — Australia & New Zealand — left unassigned: the counselor on shift has not signed in for 5 working days',
        detailsAr: null,
      }),
    ])
    renderPanel()
    await screen.findByText(/Created new-client visit for Sample Client/)

    const red = document.querySelector('.activity-detail-absent')!
    expect(red).not.toBeNull()
    expect(red.textContent).toBe(
      'left unassigned: the counselor on shift has not signed in for 5 working days'
    )
    // الدولة تبقى رمادية — ما نلوّن نص السطر
    expect(red.textContent).not.toContain('Australia')
    expect(document.querySelector('.activity-row-dot.absent-choice')).not.toBeNull()
  })

  it('leaves an ordinary Visit created row alone', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details: 'Created new-client visit for Sample Client — USA',
        detailsAr: null,
      }),
    ])
    renderPanel()
    await screen.findByText('Created new-client visit for Sample Client — USA')
    expect(document.querySelector('.activity-detail-absent')).toBeNull()
    expect(document.querySelector('.activity-row-dot.absent-choice')).toBeNull()
  })
})

// صفوف من قبل ٢١ سبتمبر ما تحمل سبب الغياب إطلاقاً — الميزة ما كانت موجودة.
// اللي نقدر نتأكد منه هو النتيجة: العميل لسا بدون مستشار
describe('old rows with no reason written in them', () => {
  it('reddens the row when that client still has nobody', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details: 'Created new-client visit for Sample Client — USA',
        detailsAr: null,
        clientStillUnassigned: true,
      }),
    ])
    renderPanel()
    await screen.findByText('Created new-client visit for Sample Client — USA')
    expect(document.querySelector('.activity-row-dot.absent-choice')).not.toBeNull()
    // ما فيه جملة سبب بهالصف، فما فيه شي نلوّنه — ولا نلوّن اسم الدولة
    expect(document.querySelector('.activity-detail-absent')).toBeNull()
  })

  it('leaves it grey once that client has a counselor', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details: 'Created new-client visit for Sample Client — USA',
        detailsAr: null,
        clientStillUnassigned: false,
      }),
    ])
    renderPanel()
    await screen.findByText('Created new-client visit for Sample Client — USA')
    expect(document.querySelector('.activity-row-dot.absent-choice')).toBeNull()
  })

  // الحقل ما يجي من السيرفر القديم — ما ينفجر، يتصرّف كأنه false
  it('survives a row that has no flag at all', async () => {
    mockLogs([
      row({
        action: 'visit_created',
        details: 'Created new-client visit for Sample Client — USA',
        detailsAr: null,
      }),
    ])
    renderPanel()
    await screen.findByText('Created new-client visit for Sample Client — USA')
    expect(document.querySelector('.activity-row-dot.absent-choice')).toBeNull()
  })
})
describe('ActivityLogPanel footer and cap notice', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('says everything is shown, with the real count, when the period fits', async () => {
    mockLogs([row(), row(), row()], { inRange: 3, allTime: 3 })
    renderPanel()

    expect(
      await screen.findByText("That's everything for this period — 3 events.")
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/most recent events of this period are loaded/)
    ).not.toBeInTheDocument()
  })

  it('warns above the list and gives the true numbers when the period holds more than was loaded', async () => {
    mockLogs([row(), row(), row()], { inRange: 4210, allTime: 5000 })
    renderPanel()

    const notice = await screen.findByRole('status')
    expect(notice).toHaveTextContent(
      "Only the 3 most recent events of this period are loaded. Older ones aren't shown here. Export this period to get all of them."
    )
    expect(screen.getByText('Showing the 3 most recent of 4210 events.')).toBeInTheDocument()
    // التنبيه فوق القائمة، مو مدفون تحتها
    expect(
      notice.compareDocumentPosition(screen.getByRole('listbox')) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
  })

  it('never claims a fixed 200, and never suggests narrowing the range', async () => {
    mockLogs([row(), row()], { inRange: 1500, allTime: 1500 })
    renderPanel()

    await screen.findByRole('status')
    expect(screen.queryByText(/\b200\b/)).not.toBeInTheDocument()
    expect(screen.queryByText(/[Nn]arrow the range/)).not.toBeInTheDocument()
  })

  it('keeps the cap notice when a filter leaves nothing to show', async () => {
    mockLogs([row({ action: 'visit_closed' })], { inRange: 2000, allTime: 2000 })
    renderPanel()
    await screen.findByRole('status')

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzz-no-match' } })

    await screen.findByText('No events match these filters')
    expect(screen.getByRole('status')).toHaveTextContent('Older ones aren')
  })

  it('shows the footer and the notice in Arabic', async () => {
    document.cookie = 'app-language=ar; path=/'
    try {
      mockLogs([row(), row()], { inRange: 1200, allTime: 1200 })
      renderPanel()
      expect(await screen.findByRole('status')).toHaveTextContent(
        'محمّل بس آخر 2 حدث من هالفترة. الأقدم منها ما يظهر هنا. «تصدير هذه الفترة» يجيبها كلها.'
      )
      expect(screen.getByText('معروض آخر 2 حدث من أصل 1200.')).toBeInTheDocument()
    } finally {
      document.cookie = 'app-language=; path=/; max-age=0'
    }
  })
})
