import { describe, it, expect } from 'vitest'
import { validateNote, MAX_NOTE_LENGTH } from './validateNote'

describe('validateNote', () => {
  it('accepts null (no note)', () => {
    expect(validateNote(null)).toEqual({ isValid: true })
  })

  it('accepts undefined (no note)', () => {
    expect(validateNote(undefined)).toEqual({ isValid: true })
  })

  it('accepts a short note', () => {
    expect(validateNote('Needs a follow-up call')).toEqual({ isValid: true })
  })

  it(`accepts a note exactly at the ${MAX_NOTE_LENGTH}-character limit`, () => {
    expect(validateNote('a'.repeat(MAX_NOTE_LENGTH))).toEqual({ isValid: true })
  })

  it(`rejects a note over ${MAX_NOTE_LENGTH} characters`, () => {
    const result = validateNote('a'.repeat(MAX_NOTE_LENGTH + 1))
    expect(result.isValid).toBe(false)
  })

  it('rejects a non-string value', () => {
    const result = validateNote(12345)
    expect(result.isValid).toBe(false)
  })
})
