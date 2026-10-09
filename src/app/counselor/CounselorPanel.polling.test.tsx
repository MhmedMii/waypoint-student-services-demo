import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'
import { LanguageProvider } from '../../i18n/LanguageContext'
import { CounselorPanel } from './CounselorPanel'

function mockQueueResponse() {
  return {
    currentVisit: null,
    elapsed: { status: 'not_started' },
    waitingCount: 0,
    nextWaitingName: null,
    breakTotalMsToday: 0,
    openBreakElapsed: { status: 'not_started' },
  }
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('CounselorPanel polling interval', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
    global.fetch = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ ok: true, status: 200, json: async () => mockQueueResponse() })
      ) as any
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('fetches the queue on mount and again every 5000ms, not more, not less', async () => {
    render(
      <LanguageProvider>
        <CounselorPanel />
      </LanguageProvider>
    )

    await act(async () => {
      await Promise.resolve()
    })
    // أول نداء للجلب + الثاني لعدّاد العرض المحلي — نداء وحدة الطلب هنا فقط
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(4999)
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(1)
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)

    await act(async () => {
      vi.advanceTimersByTime(15000)
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(5)
  })

  it('stops fetching while the tab is hidden, and catches up when it is visible again', async () => {
    render(
      <LanguageProvider>
        <CounselorPanel />
      </LanguageProvider>
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    setHidden(true)
    await act(async () => {
      vi.advanceTimersByTime(20000)
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(1)

    await act(async () => {
      setHidden(false)
      await Promise.resolve()
    })
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
