import { describe, it, expect } from 'vitest'
import { validateSpecializationScopes } from './validateSpecializationScopes'

describe('validateSpecializationScopes', () => {
  it('accepts a list of known scopes', () => {
    const result = validateSpecializationScopes(['visa_services', 'GCC'])
    expect(result).toEqual({ isValid: true })
  })

  it('accepts exam_services as a known scope', () => {
    const result = validateSpecializationScopes(['exam_services'])
    expect(result).toEqual({ isValid: true })
  })

  it('accepts an empty list', () => {
    expect(validateSpecializationScopes([])).toEqual({ isValid: true })
  })

  it('rejects an unknown scope value', () => {
    const result = validateSpecializationScopes(['visa_services', 'not_a_real_scope'])
    expect(result.isValid).toBe(false)
  })
})
