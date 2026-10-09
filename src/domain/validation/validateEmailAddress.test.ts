import { describe, it, expect } from 'vitest'
import { validateEmailAddress } from './validateEmailAddress'

describe('validateEmailAddress', () => {
  it('accepts a well-formed address from any domain', () => {
    expect(validateEmailAddress('person@example.net')).toEqual({ isValid: true })
  })

  it('trims whitespace around a valid address', () => {
    expect(validateEmailAddress(' person@example.net ')).toEqual({ isValid: true })
  })

  it('rejects malformed addresses', () => {
    const result = validateEmailAddress('not-an-email')
    expect(result.isValid).toBe(false)
  })
})
