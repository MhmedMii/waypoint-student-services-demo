import { describe, it, expect } from 'vitest'
import { isTokenExpired } from './isTokenExpired'

describe('isTokenExpired', () => {
  it('is not expired before the expiry time', () => {
    expect(isTokenExpired(new Date('2026-08-12T11:00:00Z'), new Date('2026-08-12T10:00:00Z'))).toBe(
      false
    )
  })

  it('is expired at or after the expiry time', () => {
    expect(isTokenExpired(new Date('2026-08-12T10:00:00Z'), new Date('2026-08-12T10:00:00Z'))).toBe(
      true
    )
    expect(isTokenExpired(new Date('2026-08-12T09:00:00Z'), new Date('2026-08-12T10:00:00Z'))).toBe(
      true
    )
  })
})
