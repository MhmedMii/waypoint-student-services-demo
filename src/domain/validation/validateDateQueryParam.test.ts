import { describe, it, expect } from 'vitest'
import { validateDateQueryParam } from './validateDateQueryParam'

const fallback = new Date('2026-08-05T00:00:00Z')

describe('validateDateQueryParam', () => {
  it('returns the fallback date when the raw value is missing', () => {
    const result = validateDateQueryParam(null, fallback)
    expect(result).toEqual({ isValid: true, date: fallback })
  })

  it('parses a valid ISO date string', () => {
    const result = validateDateQueryParam('2026-08-01T00:00:00Z', fallback)
    expect(result.isValid).toBe(true)
    if (result.isValid) expect(result.date.toISOString()).toBe('2026-08-01T00:00:00.000Z')
  })

  it('rejects a malformed date string', () => {
    const result = validateDateQueryParam('not-a-date', fallback)
    expect(result.isValid).toBe(false)
  })

  it('rejects an empty string', () => {
    const result = validateDateQueryParam('', fallback)
    expect(result.isValid).toBe(false)
  })
})
