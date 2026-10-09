import { describe, it, expect } from 'vitest'
import { validateRole } from './validateRole'

describe('validateRole', () => {
  it.each(['counselor', 'admin', 'super_admin'])('accepts the valid role "%s"', (role) => {
    expect(validateRole(role)).toEqual({ isValid: true })
  })

  it('rejects an unknown role value', () => {
    const result = validateRole('root')
    expect(result.isValid).toBe(false)
  })

  it('rejects an empty role', () => {
    expect(validateRole('').isValid).toBe(false)
  })
})
