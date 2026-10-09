import { describe, it, expect } from 'vitest'
import { createTieredLockout } from './tieredLockout'

describe('createTieredLockout', () => {
  it('is not blocked before any failed attempt', () => {
    const lockout = createTieredLockout()
    expect(lockout.isBlocked('a', Date.now())).toBe(false)
  })

  it('is not blocked after 1 or 2 failed attempts', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    lockout.recordFailedAttempt('a', now)
    lockout.recordFailedAttempt('a', now)
    expect(lockout.isBlocked('a', now)).toBe(false)
  })

  it('blocks for 3 minutes starting at the 3rd failed attempt', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 3; i++) lockout.recordFailedAttempt('a', now)

    expect(lockout.isBlocked('a', now)).toBe(true)
    expect(lockout.isBlocked('a', now + 2 * 60 * 1000 + 59 * 1000)).toBe(true)
    expect(lockout.isBlocked('a', now + 3 * 60 * 1000)).toBe(false)
  })

  it('escalates to a 5 minute block starting at the 5th failed attempt', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 5; i++) lockout.recordFailedAttempt('a', now)

    expect(lockout.isBlocked('a', now)).toBe(true)
    expect(lockout.isBlocked('a', now + 4 * 60 * 1000 + 59 * 1000)).toBe(true)
    expect(lockout.isBlocked('a', now + 5 * 60 * 1000)).toBe(false)
  })

  it('escalates to a 15 minute block starting at the 8th failed attempt', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 8; i++) lockout.recordFailedAttempt('a', now)

    expect(lockout.isBlocked('a', now)).toBe(true)
    expect(lockout.isBlocked('a', now + 14 * 60 * 1000 + 59 * 1000)).toBe(true)
    expect(lockout.isBlocked('a', now + 15 * 60 * 1000)).toBe(false)
  })

  it('keeps the 15 minute tier for every failed attempt beyond the 8th', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 9; i++) lockout.recordFailedAttempt('a', now)

    expect(lockout.isBlocked('a', now + 14 * 60 * 1000 + 59 * 1000)).toBe(true)
    expect(lockout.isBlocked('a', now + 15 * 60 * 1000)).toBe(false)
  })

  it('does not count as blocked once the block window elapses, but keeps the failure count', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 3; i++) lockout.recordFailedAttempt('a', now)

    const afterFirstBlock = now + 3 * 60 * 1000
    expect(lockout.isBlocked('a', afterFirstBlock)).toBe(false)

    lockout.recordFailedAttempt('a', afterFirstBlock)
    expect(lockout.isBlocked('a', afterFirstBlock)).toBe(true)
    expect(lockout.isBlocked('a', afterFirstBlock + 2 * 60 * 1000 + 59 * 1000)).toBe(true)
    expect(lockout.isBlocked('a', afterFirstBlock + 3 * 60 * 1000)).toBe(false)
  })

  it('tracks each key independently', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 3; i++) lockout.recordFailedAttempt('a', now)
    expect(lockout.isBlocked('b', now)).toBe(false)
  })

  it('clear resets a key immediately', () => {
    const lockout = createTieredLockout()
    const now = Date.now()
    for (let i = 0; i < 3; i++) lockout.recordFailedAttempt('a', now)
    lockout.clear('a')
    expect(lockout.isBlocked('a', now)).toBe(false)
  })
})
