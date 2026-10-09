import { describe, it, expect } from 'vitest'
import { formatTurnaround } from './formatTurnaround'

describe('formatTurnaround', () => {
  it('keeps hours below two days', () => {
    expect(formatTurnaround(0)).toEqual({ value: 0, unit: 'hours' })
    expect(formatTurnaround(6)).toEqual({ value: 6, unit: 'hours' })
    expect(formatTurnaround(47.4)).toEqual({ value: 47, unit: 'hours' })
  })

  it('switches to days at exactly 48 hours', () => {
    expect(formatTurnaround(47.9)).toEqual({ value: 48, unit: 'hours' })
    expect(formatTurnaround(48)).toEqual({ value: 2, unit: 'days' })
  })

  // الأرقام اللي شافها الفريق فعلاً على الشاشة
  it.each([
    [430, 18],
    [645, 27],
    [788, 33],
  ])('reads %ih as %id', (hours, days) => {
    expect(formatTurnaround(hours)).toEqual({ value: days, unit: 'days' })
  })

  it('never shows a negative figure if the clock disagrees', () => {
    expect(formatTurnaround(-5)).toEqual({ value: 0, unit: 'hours' })
  })
})
