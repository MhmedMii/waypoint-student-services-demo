import { describe, it, expect } from 'vitest'
import { isRecentOpenDuplicateVisit } from './isRecentOpenDuplicateVisit'

describe('isRecentOpenDuplicateVisit', () => {
  it('returns false when there is no prior visit', () => {
    expect(isRecentOpenDuplicateVisit(null, new Date('2026-09-16T10:16:00Z'))).toBe(false)
  })

  it('blocks a still-open visit created 2 minutes ago, like Fictional Student A', () => {
    const prior = { status: 'next' as const, createdAt: new Date('2026-09-16T10:14:00Z') }
    expect(isRecentOpenDuplicateVisit(prior, new Date('2026-09-16T10:16:00Z'))).toBe(true)
  })

  it('blocks a still-open visit created 17 minutes ago, like Fictional Student I', () => {
    const prior = { status: 'next' as const, createdAt: new Date('2026-09-13T16:15:00Z') }
    expect(isRecentOpenDuplicateVisit(prior, new Date('2026-09-13T16:32:00Z'))).toBe(true)
  })

  it('allows it once the prior visit has been closed, even minutes later', () => {
    const prior = { status: 'closed' as const, createdAt: new Date('2026-09-16T10:14:00Z') }
    expect(isRecentOpenDuplicateVisit(prior, new Date('2026-09-16T10:16:00Z'))).toBe(false)
  })

  it('allows a real return visit the next day, like Khaled Alhashash', () => {
    const prior = { status: 'next' as const, createdAt: new Date('2026-09-16T09:00:00Z') }
    expect(isRecentOpenDuplicateVisit(prior, new Date('2026-09-17T09:00:00Z'))).toBe(false)
  })

  it('treats exactly 30 minutes as no longer a duplicate', () => {
    const prior = { status: 'next' as const, createdAt: new Date('2026-09-16T10:00:00Z') }
    expect(isRecentOpenDuplicateVisit(prior, new Date('2026-09-16T10:30:00Z'))).toBe(false)
  })
})
