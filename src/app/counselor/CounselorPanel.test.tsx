// src/app/counselor/CounselorPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { CounselorPanel } from './CounselorPanel'
import { defaultFollowUpDueDate } from '../../domain/time/defaultFollowUpDueDate'
import { isKuwaitWorkingDay } from '../../domain/time/workingDaysSinceLastSeen'

function renderCounselorPanel() {
  return render(
    <LanguageProvider>
      <CounselorPanel />
    </LanguageProvider>
  )
}

function mockQueueResponse(overrides: any = {}) {
  return {
    currentVisit: null,
    elapsed: { status: 'not_started' },
    waitingCount: 1,
    nextWaitingName: 'Noura Reed',
    breakTotalMsToday: 0,
    openBreakElapsed: { status: 'not_started' },
    servedToday: 0,
    avgHandlingMs: null,
    ...overrides,
  }
}

describe('CounselorPanel', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({ ok: true, status: 200, json: async () => mockQueueResponse() })
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any
  })

  it('shows the waiting client and enables Next', async () => {
    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText(/Noura Reed/)).toBeInTheDocument())
    expect(screen.getByText('Next')).not.toBeDisabled()
  })

  it('calls the next endpoint when Next is clicked', async () => {
    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText('Next')).not.toBeDisabled())
    fireEvent.click(screen.getByText('Next'))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/counselor/next',
        expect.objectContaining({ method: 'POST' })
      )
    )
  })

  it('shows the status-picker after Finish & Next, and only enables Done once a status is picked', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            mockQueueResponse({ currentVisit: { id: 'v1', name: 'Demo Student One' } }),
        })
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any

    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Finish & Next'))
    await waitFor(() => expect(screen.getByText(/How did it go with/)).toBeInTheDocument())

    expect(screen.getByText('Done')).toBeDisabled()
    fireEvent.click(screen.getByText('Follow-up needed'))
    expect(screen.getByText('Done')).not.toBeDisabled()

    fireEvent.click(screen.getByText('Done'))
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/counselor/finish',
        expect.objectContaining({ method: 'POST' })
      )
    )
    const finishCall = (global.fetch as any).mock.calls.find(
      ([url]: [string]) => url === '/api/counselor/finish'
    )
    const body = JSON.parse(finishCall[1].body)
    expect(body).toEqual({
      visitId: 'v1',
      studentStatus: 'follow_up_needed',
      note: null,
      followUpDueAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })

  it('requires a follow-up due date before Done is enabled, and pre-fills one 3 days out', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () =>
            mockQueueResponse({ currentVisit: { id: 'v1', name: 'Demo Student One' } }),
        })
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any

    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Finish & Next'))
    await waitFor(() => expect(screen.getByText(/How did it go with/)).toBeInTheDocument())
    fireEvent.click(screen.getByText('Follow-up needed'))

    // كان يعيد كتابة القاعدة هنا (+٣ أيام تقويم) فيفوته إن القاعدة تغيّرت.
    // نسأل نفس الدالة اللي تستخدمها الشاشة: ثلاثة أيام دوام بحدود الكويت
    const dateInput = screen.getByLabelText('Follow-up due') as HTMLInputElement
    expect(dateInput.value).toBe(defaultFollowUpDueDate())
    expect(isKuwaitWorkingDay(new Date(`${dateInput.value}T09:00:00Z`))).toBe(true)
    expect(screen.getByText('Done')).not.toBeDisabled()

    fireEvent.change(dateInput, { target: { value: '' } })
    expect(screen.getByText('Done')).toBeDisabled()
  })
})
// الشاشة كانت تاخذ أي رد وتحطه بالحالة. الـ 401 يرد {ok:false}، فتصير هي
// الـ view — كائن ناقص يعدّي شرط !view، وأول قراءة openBreakElapsed.status
// ترمي والصفحة تطلع بيضاء. مستشار يرجع من عند عميل ويلقى لا شي
describe('CounselorPanel — when the queue cannot be loaded', () => {
  function respondWith(response: Record<string, unknown>) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue') return Promise.resolve(response)
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any
  }

  it('says the session ended instead of rendering a blank page', async () => {
    respondWith({ ok: false, status: 401, json: async () => ({ ok: false }) })
    renderCounselorPanel()

    expect(await screen.findByText('Your session has ended')).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('offers a way back in, so the counselor is not stranded', async () => {
    respondWith({ ok: false, status: 401, json: async () => ({ ok: false }) })
    renderCounselorPanel()

    const link = await screen.findByText('Sign in')
    expect(link.getAttribute('href')).toBe('/login')
  })

  it('explains a server failure and offers a retry', async () => {
    respondWith({ ok: false, status: 500, json: async () => ({ ok: false }) })
    renderCounselorPanel()

    expect(await screen.findByText('Could not load your queue')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
  })

  // حارس الشكل: رد ٢٠٠ بجسم ما نتوقعه ما يصير حالة الشاشة
  it('refuses a 200 whose body is not a queue at all', async () => {
    respondWith({ ok: true, status: 200, json: async () => ({ ok: false }) })
    renderCounselorPanel()

    expect(await screen.findByText('Could not load your queue')).toBeInTheDocument()
  })

  it('survives a body that is null', async () => {
    respondWith({ ok: true, status: 200, json: async () => null })
    renderCounselorPanel()

    expect(await screen.findByText('Could not load your queue')).toBeInTheDocument()
  })

  it('survives the fetch throwing outright', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('offline')) as any
    renderCounselorPanel()

    expect(await screen.findByText('Could not load your queue')).toBeInTheDocument()
  })
})
// كانت ترسل بلا ما تتأكد من الرد ثم تمسح كل شي. الطلب لو طاح: الملاحظة تروح،
// الزيارة تظل مفتوحة، والمستشار يشوف الشاشة رجعت طبيعية فيظن إنه خلّص
describe('CounselorPanel — when finishing a visit fails', () => {
  const SERVING = { currentVisit: { id: 'v1', name: 'Demo Student One' } }

  function mockFinish(finishResponse: Record<string, unknown>) {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockQueueResponse(SERVING),
        })
      if (url === '/api/counselor/finish') return Promise.resolve(finishResponse)
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any
  }

  async function typeNoteAndFinish(text: string) {
    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText('Demo Student One')).toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText(/note/i), { target: { value: text } })
    fireEvent.click(screen.getByText('Finish & Next'))
    await waitFor(() => expect(screen.getByText(/How did it go with/)).toBeInTheDocument())
    // الزر معطّل لين تُختار حالة — نختار "مغلقة" لأنها ما تطلب تاريخ متابعة
    fireEvent.click(screen.getByText('Closed'))
    fireEvent.click(screen.getByText('Done'))
  }

  // الدليل الحقيقي إن الملاحظة نجت: المحاولة الثانية ترسلها نفسها كاملة
  it('still has the typed note when the counselor retries', async () => {
    let failNext = true
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockQueueResponse(SERVING),
        })
      if (url === '/api/counselor/finish') {
        if (failNext) {
          failNext = false
          return Promise.resolve({ ok: false, status: 500, json: async () => ({ ok: false }) })
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any

    await typeNoteAndFinish('Client needs the IELTS dates')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Try again'))
    await waitFor(() => expect(screen.queryByText(/How did it go with/)).not.toBeInTheDocument())

    const finishCalls = (global.fetch as any).mock.calls.filter(
      ([url]: [string]) => url === '/api/counselor/finish'
    )
    expect(finishCalls).toHaveLength(2)
    // نفس الملاحظة بالضبط بالمحاولتين — ما ضاع منها حرف
    for (const call of finishCalls) {
      expect(JSON.parse(call[1].body).note).toBe('Client needs the IELTS dates')
    }
  })

  it('says what went wrong rather than looking like it worked', async () => {
    mockFinish({ ok: false, status: 500, json: async () => ({ ok: false }) })
    await typeNoteAndFinish('a note')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Not saved')
    expect(alert.textContent).toContain('still here')
  })

  it('names the reason when the server gives one', async () => {
    mockFinish({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, reason: 'notYourVisit' }),
    })
    await typeNoteAndFinish('a note')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('another counselor')
  })

  it('stays on the wrap-up card so the work can be retried', async () => {
    mockFinish({ ok: false, status: 500, json: async () => ({ ok: false }) })
    await typeNoteAndFinish('a note')

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByText(/How did it go with/)).toBeInTheDocument()
    expect(screen.getByText('Try again')).not.toBeDisabled()
  })

  it('survives the request throwing outright', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockQueueResponse(SERVING),
        })
      return Promise.reject(new Error('offline'))
    }) as any
    await typeNoteAndFinish('a note')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Not saved')
  })

  it('clears the note only once the save has actually succeeded', async () => {
    mockFinish({ ok: true, status: 200, json: async () => ({ ok: true }) })
    await typeNoteAndFinish('a note')

    await waitFor(() => expect(screen.queryByText(/How did it go with/)).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await waitFor(() =>
      expect((screen.getByPlaceholderText(/note/i) as HTMLTextAreaElement).value).toBe('')
    )
  })
})
// الأخطر فيها الاستراحة: لو الطلب طاح بصمت، المستشار يظن إنه بإستراحة
// والنظام يظن إنه شغال — فوقت الاستراحة ينحسب غلط ومعه كل متوسط مبني عليه
describe('CounselorPanel — when an action does not go through', () => {
  function mockAction(url: string, response: Record<string, unknown>) {
    global.fetch = vi.fn().mockImplementation((called: string) => {
      if (called === '/api/counselor/queue')
        return Promise.resolve({ ok: true, status: 200, json: async () => mockQueueResponse() })
      if (called === url) return Promise.resolve(response)
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any
  }

  async function clickWhenReady(label: string) {
    renderCounselorPanel()
    await waitFor(() => expect(screen.getByText(label)).not.toBeDisabled())
    fireEvent.click(screen.getByText(label))
  }

  it('says so when starting a break fails, instead of looking like it worked', async () => {
    mockAction('/api/counselor/break-out', {
      ok: false,
      status: 400,
      json: async () => ({ ok: false, reason: 'breakWhileServing' }),
    })
    await clickWhenReady('Break out')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Cannot start a break while serving a client')
  })

  it('says so when ending a break fails', async () => {
    mockAction('/api/counselor/break-in', {
      ok: false,
      status: 500,
      json: async () => ({ ok: false }),
    })
    // "Break in" معطّل ما لم يكن بإستراحة فعلاً — نشغّل الاستراحة بالحالة
    global.fetch = vi.fn().mockImplementation((called: string) => {
      if (called === '/api/counselor/queue')
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockQueueResponse({ openBreakElapsed: { status: 'running' } }),
        })
      if (called === '/api/counselor/break-in')
        return Promise.resolve({ ok: false, status: 500, json: async () => ({ ok: false }) })
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) })
    }) as any
    await clickWhenReady('Break in')
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBeTruthy()
  })

  it('says so when calling the next client fails', async () => {
    mockAction('/api/counselor/next', {
      ok: false,
      status: 400,
      json: async () => ({ ok: false, reason: 'noClientWaiting' }),
    })
    await clickWhenReady('Next')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('No client assigned and waiting')
  })

  it('falls back to a plain message when the server gives no reason', async () => {
    mockAction('/api/counselor/next', { ok: false, status: 500, json: async () => ({}) })
    await clickWhenReady('Next')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Nothing has changed')
  })

  it('survives the request throwing outright', async () => {
    global.fetch = vi.fn().mockImplementation((called: string) => {
      if (called === '/api/counselor/queue')
        return Promise.resolve({ ok: true, status: 200, json: async () => mockQueueResponse() })
      return Promise.reject(new Error('offline'))
    }) as any
    await clickWhenReady('Next')

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Nothing has changed')
  })

  it('stays quiet when the action succeeds', async () => {
    mockAction('/api/counselor/next', { ok: true, status: 200, json: async () => ({ ok: true }) })
    await clickWhenReady('Next')

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('/api/counselor/next', expect.anything())
    )
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
