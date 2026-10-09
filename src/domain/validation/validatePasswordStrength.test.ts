import { describe, it, expect } from 'vitest'
import { validatePasswordStrength } from './validatePasswordStrength'

describe('validatePasswordStrength', () => {
  it('accepts a password with at least 8 characters', () => {
    expect(validatePasswordStrength('temp-pass-123')).toEqual({ isValid: true })
  })

  it('rejects a password shorter than 8 characters', () => {
    const result = validatePasswordStrength('short1')
    expect(result.isValid).toBe(false)
  })

  it('rejects an empty password', () => {
    expect(validatePasswordStrength('').isValid).toBe(false)
  })
})
