import { describe, test, expect } from 'vitest'
import { formatLastSeenAgo } from './formatLastSeenAgo'

describe('formatLastSeenAgo', () => {
  test('formats under a day as hours/minutes/seconds', () => {
    expect(formatLastSeenAgo(2 * 3600 + 3 * 60 + 27)).toBe('2h 3m 27s ago')
  })

  test('formats a day or more as days + remainder hours', () => {
    expect(formatLastSeenAgo(100 * 3600 + 31 * 60 + 51)).toBe('4 days, 4h ago')
  })

  test('drops the remainder hours when they are zero', () => {
    expect(formatLastSeenAgo(96 * 3600 + 44 * 60 + 20)).toBe('4 days ago')
  })

  test('uses singular "day" for exactly one day', () => {
    expect(formatLastSeenAgo(25 * 3600)).toBe('1 day, 1h ago')
  })

  test('formats under a day in Arabic', () => {
    expect(formatLastSeenAgo(2 * 3600 + 3 * 60 + 27, 'ar')).toBe('منذ 2س 3د 27ث')
  })

  test('formats days + remainder hours in Arabic', () => {
    expect(formatLastSeenAgo(100 * 3600 + 31 * 60 + 51, 'ar')).toBe('منذ 4 أيام و4س')
  })

  test('drops the remainder hours when zero, in Arabic', () => {
    expect(formatLastSeenAgo(96 * 3600 + 44 * 60 + 20, 'ar')).toBe('منذ 4 أيام')
  })

  test('uses the dual form for exactly two days in Arabic', () => {
    expect(formatLastSeenAgo(48 * 3600, 'ar')).toBe('منذ يومين')
  })

  test('uses the singular form for exactly one day in Arabic', () => {
    expect(formatLastSeenAgo(25 * 3600, 'ar')).toBe('منذ يوم واحد و1س')
  })
})
