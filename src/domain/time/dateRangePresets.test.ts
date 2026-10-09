import { describe, it, expect } from 'vitest'
import { computeDateRangeForPreset } from './dateRangePresets'

describe('computeDateRangeForPreset', () => {
  const now = new Date('2026-08-14T10:00:00Z')

  it('returns the last 7 days for "week"', () => {
    expect(computeDateRangeForPreset('week', now)).toEqual({ from: '2026-08-07', to: '2026-08-14' })
  })

  it('returns month-to-date for "month"', () => {
    expect(computeDateRangeForPreset('month', now)).toEqual({
      from: '2026-08-01',
      to: '2026-08-14',
    })
  })

  it('returns quarter-to-date for "quarter"', () => {
    expect(computeDateRangeForPreset('quarter', now)).toEqual({
      from: '2026-07-01',
      to: '2026-08-14',
    })
  })

  it('returns half-year-to-date for "half_year"', () => {
    expect(computeDateRangeForPreset('half_year', now)).toEqual({
      from: '2026-07-01',
      to: '2026-08-14',
    })
    expect(computeDateRangeForPreset('half_year', new Date('2026-03-05T00:00:00Z'))).toEqual({
      from: '2026-01-01',
      to: '2026-03-05',
    })
  })

  it('returns year-to-date for "year"', () => {
    expect(computeDateRangeForPreset('year', now)).toEqual({ from: '2026-01-01', to: '2026-08-14' })
  })

  // بين 12 و3 الفجر بالكويت تاريخ UTC يظل أمس — "اليوم" لازم يتبع الكويت
  it('uses the Kuwait calendar day, not the UTC day', () => {
    const justAfterKuwaitMidnight = new Date('2026-09-20T22:00:00Z') // 1 AM 21 سبتمبر بالكويت
    expect(computeDateRangeForPreset('week', justAfterKuwaitMidnight)).toEqual({
      from: '2026-09-14',
      to: '2026-09-21',
    })
    expect(computeDateRangeForPreset('month', new Date('2026-08-31T22:00:00Z'))).toEqual({
      from: '2026-09-01',
      to: '2026-09-01',
    })
    expect(computeDateRangeForPreset('year', new Date('2025-12-31T22:00:00Z'))).toEqual({
      from: '2026-01-01',
      to: '2026-01-01',
    })
  })

  it('keeps the same day until Kuwait midnight (9 PM UTC), so nothing is cut late in the evening', () => {
    expect(computeDateRangeForPreset('week', new Date('2026-09-20T20:59:00Z')).to).toBe(
      '2026-09-20'
    )
    expect(computeDateRangeForPreset('week', new Date('2026-09-20T21:00:00Z')).to).toBe(
      '2026-09-21'
    )
  })
})
