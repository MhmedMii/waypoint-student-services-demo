import { describe, it, expect } from 'vitest'
import { validateShiftInfo } from './validateShiftInfo'

describe('validateShiftInfo', () => {
  it('accepts a valid shift/floor combination', () => {
    expect(validateShiftInfo('day', 'M1')).toEqual({ isValid: true })
  })

  it('accepts all-null (clearing the assignment)', () => {
    expect(validateShiftInfo(null, null)).toEqual({ isValid: true })
  })

  it('rejects an unknown shift value', () => {
    const result = validateShiftInfo('afternoon', 'M1')
    expect(result.isValid).toBe(false)
  })

  it('rejects an unknown floor value', () => {
    const result = validateShiftInfo('day', 'M2')
    expect(result.isValid).toBe(false)
  })

  it('rejects a partial combination (only one field null)', () => {
    const result = validateShiftInfo('day', null)
    expect(result.isValid).toBe(false)
  })
})
