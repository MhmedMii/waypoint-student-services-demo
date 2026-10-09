import { describe, it, expect } from 'vitest'
import { validateFollowUpDueDate } from './validateFollowUpDueDate'

describe('validateFollowUpDueDate', () => {
  it('requires a date when the student status is follow_up_needed', () => {
    const result = validateFollowUpDueDate('follow_up_needed', undefined)
    expect(result.isValid).toBe(false)
    if (!result.isValid) expect(result.reason).toBe('followUpDueDateRequired')
  })

  it('rejects an empty string', () => {
    const result = validateFollowUpDueDate('follow_up_needed', '')
    expect(result.isValid).toBe(false)
  })

  it('rejects a value that does not parse as a date', () => {
    const result = validateFollowUpDueDate('follow_up_needed', 'not-a-date')
    expect(result.isValid).toBe(false)
  })

  it('accepts a valid date string when follow_up_needed', () => {
    const result = validateFollowUpDueDate('follow_up_needed', '2026-09-22')
    expect(result.isValid).toBe(true)
    if (result.isValid) expect(result.date).toEqual(new Date('2026-09-22'))
  })

  it('ignores any value and returns null when the status is not follow_up_needed', () => {
    const result = validateFollowUpDueDate('closed', '2026-09-22')
    expect(result.isValid).toBe(true)
    if (result.isValid) expect(result.date).toBeNull()
  })

  it('returns null for waiting with no date given', () => {
    const result = validateFollowUpDueDate('waiting', undefined)
    expect(result.isValid).toBe(true)
    if (result.isValid) expect(result.date).toBeNull()
  })
})
