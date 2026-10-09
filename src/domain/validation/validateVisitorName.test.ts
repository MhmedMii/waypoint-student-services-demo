import { describe, it, expect } from 'vitest'
import { validateVisitorName } from './validateVisitorName'

describe('validateVisitorName', () => {
  it('accepts a two-word English name', () => {
    expect(validateVisitorName('Demo Student One')).toEqual({ isValid: true })
  })

  it('accepts a two-word Arabic name', () => {
    expect(validateVisitorName('أحمد السالم')).toEqual({ isValid: true })
  })

  it('rejects a single word', () => {
    const result = validateVisitorName('Ahmad')
    expect(result.isValid).toBe(false)
  })

  it('accepts three or more words', () => {
    expect(validateVisitorName('Demo Student Sample Identity')).toEqual({ isValid: true })
  })

  it('rejects a word with digits', () => {
    const result = validateVisitorName('Ahmad Sal3m')
    expect(result.isValid).toBe(false)
  })

  it('trims surrounding whitespace before checking', () => {
    expect(validateVisitorName('  Demo Student One  ')).toEqual({ isValid: true })
  })
})
