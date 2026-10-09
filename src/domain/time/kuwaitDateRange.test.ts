import { describe, it, expect } from 'vitest'
import { kuwaitDayStartFromInput, kuwaitRangeQuery } from './kuwaitDateRange'

describe('kuwaitDayStartFromInput', () => {
  it('returns Kuwait midnight as the exact UTC instant (9 PM the day before)', () => {
    expect(kuwaitDayStartFromInput('2026-09-20')?.toISOString()).toBe('2026-09-19T21:00:00.000Z')
  })

  it('handles month and year boundaries', () => {
    expect(kuwaitDayStartFromInput('2026-01-01')?.toISOString()).toBe('2025-12-31T21:00:00.000Z')
    expect(kuwaitDayStartFromInput('2028-02-29')?.toISOString()).toBe('2028-02-28T21:00:00.000Z')
  })

  it('rejects anything that is not a real calendar date', () => {
    for (const bad of [
      '',
      '2026-9-20',
      '20/09/2026',
      '2026-02-31',
      '2026-13-01',
      'abc',
      '2026-09-20T00:00',
    ]) {
      expect(kuwaitDayStartFromInput(bad)).toBeNull()
    }
  })
})

describe('kuwaitRangeQuery', () => {
  it('runs from Kuwait midnight of From to Kuwait midnight after To (exclusive)', () => {
    expect(kuwaitRangeQuery({ from: '2026-09-13', to: '2026-09-20' })).toEqual({
      from: '2026-09-12T21:00:00.000Z',
      to: '2026-09-20T21:00:00.000Z',
    })
  })

  it('includes the whole To day: a visit at 11:59 PM Kuwait falls before the upper bound', () => {
    const query = kuwaitRangeQuery({ from: '2026-09-20', to: '2026-09-20' })!
    const lateVisit = new Date('2026-09-20T20:59:00Z') // 11:59 PM الكويت
    const nextDayVisit = new Date('2026-09-20T21:01:00Z') // 12:01 AM الكويت، اليوم التالي
    expect(lateVisit >= new Date(query.from) && lateVisit < new Date(query.to)).toBe(true)
    expect(nextDayVisit < new Date(query.to)).toBe(false)
  })

  it('includes the first hours of the From day (before 3 AM Kuwait, which UTC midnight cut off)', () => {
    const query = kuwaitRangeQuery({ from: '2026-09-20', to: '2026-09-20' })!
    const earlyVisit = new Date('2026-09-19T22:00:00Z') // 1 AM الكويت
    expect(earlyVisit >= new Date(query.from)).toBe(true)
  })

  it('returns null when either date is missing or invalid', () => {
    expect(kuwaitRangeQuery({ from: '', to: '2026-09-20' })).toBeNull()
    expect(kuwaitRangeQuery({ from: '2026-09-13', to: '2026-02-31' })).toBeNull()
  })
})
