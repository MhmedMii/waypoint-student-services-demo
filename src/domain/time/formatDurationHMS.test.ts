import { describe, it, expect } from 'vitest'
import { formatDurationHMS } from './formatDurationHMS'

describe('formatDurationHMS', () => {
  it('formats hours, minutes, and seconds', () => {
    expect(formatDurationHMS(8130)).toBe('2h 15m 30s')
  })

  it('formats zero as 0h 0m 0s', () => {
    expect(formatDurationHMS(0)).toBe('0h 0m 0s')
  })

  it('rounds fractional seconds', () => {
    expect(formatDurationHMS(59.6)).toBe('0h 1m 0s')
  })

  it('clamps negative values to zero', () => {
    expect(formatDurationHMS(-5)).toBe('0h 0m 0s')
  })

  it('formats in Arabic units when language is ar', () => {
    expect(formatDurationHMS(8130, 'ar')).toBe('2س 15د 30ث')
  })
})
