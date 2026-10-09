import { describe, it, expect } from 'vitest'
import { waitingBucket, isWaitingBucket } from './waitingBucket'

const NOW = new Date('2026-09-21T11:00:00Z') // الاثنين

describe('waitingBucket', () => {
  it('puts a visit with no counselor in unassigned', () => {
    expect(waitingBucket(null, NOW)).toBe('unassigned')
  })

  // حساب محذوف: ما راح يسجّل دخول أبداً، فالعميل عالق للأبد. قبل كذا كان
  // يسقط من كل العدّادات فما يشوفه أحد ولا مرة
  it('gives a deleted counselor account its own answer, rather than none', () => {
    expect(waitingBucket(undefined, NOW)).toBe('unknownCounselor')
  })

  it('calls five working days absent', () => {
    expect(waitingBucket({ lastSeenAt: new Date('2026-08-31T12:00:00Z') }, NOW)).toBe('absent')
  })

  it('calls one working day quiet, not absent', () => {
    expect(waitingBucket({ lastSeenAt: new Date('2026-09-20T12:00:00Z') }, NOW)).toBe('quiet')
  })

  it('says nothing is wrong when the counselor signed in today', () => {
    expect(waitingBucket({ lastSeenAt: new Date('2026-09-21T06:00:00Z') }, NOW)).toBe('attended')
  })

  it('treats a counselor who never signed in as absent', () => {
    expect(waitingBucket({ lastSeenAt: null }, NOW)).toBe('absent')
  })

  // الباراميتر يجي من الرابط، فأي نص ممكن يوصل
  it('rejects a bucket name that is not one of ours', () => {
    expect(isWaitingBucket('absent')).toBe(true)
    expect(isWaitingBucket('everything')).toBe(false)
    expect(isWaitingBucket('')).toBe(false)
  })
})
