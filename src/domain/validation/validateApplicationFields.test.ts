import { describe, test, expect } from 'vitest'
import {
  validateApplicationFields,
  type ApplicationSubmissionInput,
} from './validateApplicationFields'

function validVisaInput(
  overrides: Partial<ApplicationSubmissionInput> = {}
): ApplicationSubmissionInput {
  return {
    kind: 'visa',
    serviceCode: 'uk-student',
    name: 'Fictional Student R',
    phone: '51234567',
    fields: { passportNumber: 'A1234567' },
    ...overrides,
  }
}

describe('validateApplicationFields', () => {
  test('accepts a valid minimal payload', () => {
    expect(validateApplicationFields(validVisaInput())).toEqual({ isValid: true })
  })

  test('rejects an invalid name', () => {
    const result = validateApplicationFields(validVisaInput({ name: 'Sara' }))
    expect(result.isValid).toBe(false)
  })

  test('rejects an invalid phone', () => {
    const result = validateApplicationFields(validVisaInput({ phone: '123' }))
    expect(result.isValid).toBe(false)
  })

  test('rejects a serviceCode not in the catalog for the given kind', () => {
    const result = validateApplicationFields(validVisaInput({ serviceCode: 'ielts' }))
    expect(result.isValid).toBe(false)
  })

  test('accepts a valid exam serviceCode for kind exam', () => {
    const result = validateApplicationFields(validVisaInput({ kind: 'exam', serviceCode: 'ielts' }))
    expect(result).toEqual({ isValid: true })
  })

  test('rejects too many fields', () => {
    const fields = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`field${i}`, 'x']))
    const result = validateApplicationFields(validVisaInput({ fields }))
    expect(result.isValid).toBe(false)
  })

  test('rejects a non-string field value', () => {
    const result = validateApplicationFields(validVisaInput({ fields: { count: 5 as any } }))
    expect(result.isValid).toBe(false)
  })

  test('rejects an overly long field value', () => {
    const result = validateApplicationFields(
      validVisaInput({ fields: { notes: 'x'.repeat(2001) } })
    )
    expect(result.isValid).toBe(false)
  })
})
