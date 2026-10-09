import { describe, it, expect } from 'vitest'
import { validatePhoneNumber } from './validatePhoneNumber'

describe('validatePhoneNumber', () => {
  it.each(['4', '5', '6', '9'])('accepts an 8-digit number starting with %s', (digit) => {
    expect(validatePhoneNumber(`${digit}1234567`)).toEqual({ isValid: true })
  })

  it('rejects a number starting with 7', () => {
    expect(validatePhoneNumber('71234567').isValid).toBe(false)
  })

  it('rejects 7 digits', () => {
    expect(validatePhoneNumber('512345').isValid).toBe(false)
  })

  it('rejects 9 digits', () => {
    expect(validatePhoneNumber('512345678').isValid).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(validatePhoneNumber('5123456a').isValid).toBe(false)
  })
})
