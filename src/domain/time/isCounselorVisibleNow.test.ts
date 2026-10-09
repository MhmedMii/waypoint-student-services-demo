import { describe, expect, test } from 'vitest'
import { isCounselorVisibleNow } from './isCounselorVisibleNow'

function kuwaitTime(hours: number, minutes: number): Date {
  return new Date(Date.UTC(2026, 0, 5, hours - 3, minutes))
}

describe('isCounselorVisibleNow', () => {
  test('day shift is always visible', () => {
    expect(isCounselorVisibleNow('day', kuwaitTime(10, 0))).toBe(true)
    expect(isCounselorVisibleNow('day', kuwaitTime(18, 0))).toBe(true)
  })

  test('null shift is always visible', () => {
    expect(isCounselorVisibleNow(null, kuwaitTime(10, 0))).toBe(true)
  })

  test('night shift hidden at 14:59', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(14, 59))).toBe(false)
  })

  test('night shift hidden at 08:30', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(8, 30))).toBe(false)
  })

  test('night shift visible exactly at 15:00', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(15, 0))).toBe(true)
  })

  test('night shift visible at 21:59', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(21, 59))).toBe(true)
  })

  test('night shift hidden exactly at 22:00', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(22, 0))).toBe(false)
  })

  test('night shift hidden overnight at 02:00', () => {
    expect(isCounselorVisibleNow('night', kuwaitTime(2, 0))).toBe(false)
  })
})
