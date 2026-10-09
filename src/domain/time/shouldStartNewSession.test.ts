import { describe, test, expect } from 'vitest'
import { shouldStartNewSession } from './shouldStartNewSession'

describe('shouldStartNewSession', () => {
  test('starts a new session when there is no previous session', () => {
    const result = shouldStartNewSession(null, new Date('2026-08-12T09:00:00Z'), 120000)
    expect(result).toBe(true)
  })

  test('extends the existing session when the gap is within the threshold', () => {
    const previousEndedAt = new Date('2026-08-12T09:00:00Z')
    const now = new Date('2026-08-12T09:01:30Z')
    const result = shouldStartNewSession(previousEndedAt, now, 120000)
    expect(result).toBe(false)
  })

  test('starts a new session when the gap exceeds the threshold', () => {
    const previousEndedAt = new Date('2026-08-12T09:00:00Z')
    const now = new Date('2026-08-12T09:05:00Z')
    const result = shouldStartNewSession(previousEndedAt, now, 120000)
    expect(result).toBe(true)
  })

  test('extends when the gap is exactly at the threshold', () => {
    const previousEndedAt = new Date('2026-08-12T09:00:00Z')
    const now = new Date('2026-08-12T09:02:00Z')
    const result = shouldStartNewSession(previousEndedAt, now, 120000)
    expect(result).toBe(false)
  })
})
