import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { act } from 'react'
import { IdleAutoSignOut } from './IdleAutoSignOut'

const signOutMock = vi.fn()

vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}))

const THREE_HOURS_MS = 3 * 60 * 60 * 1000
const CHECK_INTERVAL_MS = 30 * 1000

describe('IdleAutoSignOut', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    signOutMock.mockClear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not sign out before 3 hours of inactivity', async () => {
    render(<IdleAutoSignOut />)

    await act(async () => {
      vi.advanceTimersByTime(THREE_HOURS_MS - CHECK_INTERVAL_MS)
    })

    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('signs out after 3 hours with no activity', async () => {
    render(<IdleAutoSignOut />)

    await act(async () => {
      vi.advanceTimersByTime(THREE_HOURS_MS + CHECK_INTERVAL_MS)
    })

    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/login' })
  })

  it('resets the idle timer on activity, avoiding sign-out', async () => {
    render(<IdleAutoSignOut />)

    await act(async () => {
      vi.advanceTimersByTime(THREE_HOURS_MS - CHECK_INTERVAL_MS * 2)
    })
    expect(signOutMock).not.toHaveBeenCalled()

    await act(async () => {
      window.dispatchEvent(new Event('mousemove'))
    })

    await act(async () => {
      vi.advanceTimersByTime(THREE_HOURS_MS - CHECK_INTERVAL_MS)
    })

    expect(signOutMock).not.toHaveBeenCalled()
  })
})
