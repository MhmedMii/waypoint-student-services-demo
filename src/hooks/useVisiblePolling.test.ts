import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useVisiblePolling } from './useVisiblePolling'

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useVisiblePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setHidden(false)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires immediately, then on every interval while the tab is visible', () => {
    const callback = vi.fn()
    renderHook(() => useVisiblePolling(callback, 1000))

    expect(callback).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(1000)
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('skips ticks while the tab is hidden, and catches up the moment it is visible again', () => {
    const callback = vi.fn()
    renderHook(() => useVisiblePolling(callback, 1000))
    expect(callback).toHaveBeenCalledTimes(1)

    setHidden(true)
    vi.advanceTimersByTime(5000)
    // خمس تكات إضافية ما صارت — التبويب مخفي، ما أحد شايفها
    expect(callback).toHaveBeenCalledTimes(1)

    setHidden(false)
    // يرجع يجيب فورًا لما يظهر، بدل ما ينتظر التكة الجاية
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('stops polling on unmount', () => {
    const callback = vi.fn()
    const { unmount } = renderHook(() => useVisiblePolling(callback, 1000))
    unmount()
    vi.advanceTimersByTime(5000)
    expect(callback).toHaveBeenCalledTimes(1)
  })

  // صفحة تُفتح بتبويب بالخلفية كانت ما تجيب بياناتها أبدًا، فتعلق على "جارٍ التحميل"
  it('still fires once on mount when the tab starts hidden', () => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    const callback = vi.fn()
    renderHook(() => useVisiblePolling(callback, 1000))
    expect(callback).toHaveBeenCalledTimes(1)

    // وبعد أول تحميل، التكات تظل تحترم الإخفاء
    vi.advanceTimersByTime(3000)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
