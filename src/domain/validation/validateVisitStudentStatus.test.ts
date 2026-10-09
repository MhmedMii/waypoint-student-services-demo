import { describe, it, expect } from 'vitest'
import { validateVisitStudentStatus } from './validateVisitStudentStatus'

describe('validateVisitStudentStatus', () => {
  it('accepts waiting', () => {
    expect(validateVisitStudentStatus('waiting')).toEqual({ isValid: true })
  })

  it('accepts in_session', () => {
    expect(validateVisitStudentStatus('in_session')).toEqual({ isValid: true })
  })

  it('accepts follow_up_needed', () => {
    expect(validateVisitStudentStatus('follow_up_needed')).toEqual({ isValid: true })
  })

  it('accepts closed', () => {
    expect(validateVisitStudentStatus('closed')).toEqual({ isValid: true })
  })

  it('rejects an unknown value', () => {
    const result = validateVisitStudentStatus('anything')
    expect(result.isValid).toBe(false)
    if (!result.isValid) expect(result.reason).toBe('visitStudentStatusInvalid')
  })

  it('rejects a non-string value', () => {
    const result = validateVisitStudentStatus(null)
    expect(result.isValid).toBe(false)
  })
})
