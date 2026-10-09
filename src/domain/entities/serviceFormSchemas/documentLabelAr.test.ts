import { describe, it, expect } from 'vitest'
import { documentLabelAr } from './documentLabelAr'

describe('documentLabelAr', () => {
  it('finds the Arabic label for a document shared across services', () => {
    expect(documentLabelAr('Passport copy')).toBe('نسخة جواز السفر')
  })

  it('finds the Arabic label for a service-specific document', () => {
    expect(documentLabelAr('CAS / Visa copy')).toBe('نسخة CAS / التأشيرة')
  })

  it('returns null for a label that matches no schema document', () => {
    expect(documentLabelAr('Some made-up document name')).toBeNull()
  })
})
