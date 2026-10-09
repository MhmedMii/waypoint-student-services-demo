import { describe, it, expect } from 'vitest'
import type { ServiceFormSchema } from './applicationFieldSchema'
import { field } from './applicationFieldSchema'
import { missingRequiredDocuments, visibleDocumentSlots } from './requiredDocuments'

const schema = {
  serviceCode: 'ielts',
  documents: [
    { id: 'passport', label: 'Passport copy', labelAr: 'نسخة الجواز', required: true },
    { id: 'invoice', label: 'UPay invoice', labelAr: 'فاتورة يوباي', required: true },
    { id: 'extra', label: 'Old certificate', labelAr: 'شهادة قديمة', required: false },
    {
      id: 'father-passport',
      label: "Father's passport",
      labelAr: 'جواز الأب',
      required: true,
      visibleWhen: { fieldId: 'under-18', equals: 'Yes' },
    },
  ],
  fields: [
    field({
      id: 'under-18',
      type: 'radio',
      label: 'Under 18?',
      labelAr: '',
      required: false,
      options: ['Yes', 'No'],
      defaultValue: 'No',
    }),
  ],
} as unknown as ServiceFormSchema

describe('visibleDocumentSlots', () => {
  it('hides a conditional slot while its field does not match', () => {
    expect(visibleDocumentSlots(schema, {}).map((s) => s.id)).toEqual([
      'passport',
      'invoice',
      'extra',
    ])
  })

  it('shows the conditional slot once the field matches', () => {
    expect(visibleDocumentSlots(schema, { 'under-18': 'Yes' }).map((s) => s.id)).toContain(
      'father-passport'
    )
  })
})

describe('missingRequiredDocuments', () => {
  it('lists required documents that were never uploaded', () => {
    expect(missingRequiredDocuments(schema, {}, []).map((s) => s.label)).toEqual([
      'Passport copy',
      'UPay invoice',
    ])
  })

  it('returns nothing once every required document is uploaded', () => {
    expect(missingRequiredDocuments(schema, {}, ['Passport copy', 'UPay invoice'])).toEqual([])
  })

  it('ignores optional documents, uploaded or not', () => {
    const missing = missingRequiredDocuments(schema, {}, ['Passport copy', 'UPay invoice'])
    expect(missing).toEqual([])
    expect(
      missingRequiredDocuments(schema, {}, ['Passport copy', 'UPay invoice', 'Old certificate'])
    ).toEqual([])
  })

  it('requires the conditional document only when its field matches', () => {
    const uploaded = ['Passport copy', 'UPay invoice']
    expect(missingRequiredDocuments(schema, { 'under-18': 'No' }, uploaded)).toEqual([])
    expect(
      missingRequiredDocuments(schema, { 'under-18': 'Yes' }, uploaded).map((s) => s.id)
    ).toEqual(['father-passport'])
  })

  it('ignores null labels from older rows', () => {
    expect(missingRequiredDocuments(schema, {}, [null, 'Passport copy']).map((s) => s.id)).toEqual([
      'invoice',
    ])
  })

  it('reports one missing document when only part of the upload succeeded', () => {
    expect(missingRequiredDocuments(schema, {}, ['Passport copy']).map((s) => s.label)).toEqual([
      'UPay invoice',
    ])
  })
})

// طلب صريح: الرقم ما يتجاوز أبدًا عدد المطلوب، وأسماء الناقص تطابق الرقم —
// عميل ينقال له "ناقصك ٧" وهو ناقصه ٢ ينرجع لبيته بلا داعي
describe('the count can never exceed what is required', () => {
  const everyCombination: Record<string, string>[] = [
    {},
    { 'under-18': 'Yes' },
    { 'under-18': 'No' },
    { 'proof-of-finance': 'Sponsor' },
    { 'proof-of-finance': 'Self-Funded' },
    { 'under-18': 'Yes', 'proof-of-finance': 'Sponsor' },
    { 'nonsense-field': 'nonsense-value' },
  ]

  it.each(everyCombination)('holds for answers %j', (fields) => {
    const requiredVisible = visibleDocumentSlots(schema, fields).filter((s) => s.required)
    for (const uploaded of [
      [],
      ['Passport copy'],
      ['Passport copy', 'UPay invoice'],
      ['Unknown doc'],
    ]) {
      const missing = missingRequiredDocuments(schema, fields, uploaded)
      expect(missing.length).toBeLessThanOrEqual(requiredVisible.length)
      // الأسماء هي نفسها اللي يبني منها الرقم — فما يمكن يختلفون
      expect(missing.map((s) => s.label)).toHaveLength(missing.length)
      expect(missing.every((slot) => requiredVisible.includes(slot))).toBe(true)
    }
  })

  it('counts nothing as missing once every visible required document is uploaded', () => {
    const fields = { 'under-18': 'Yes' }
    const allRequired = visibleDocumentSlots(schema, fields)
      .filter((s) => s.required)
      .map((s) => s.label)
    expect(missingRequiredDocuments(schema, fields, allRequired)).toEqual([])
  })

  it('does not count an uploaded document twice', () => {
    const duplicated = ['Passport copy', 'Passport copy', 'Passport copy']
    expect(missingRequiredDocuments(schema, {}, duplicated).map((s) => s.label)).toEqual([
      'UPay invoice',
    ])
  })
})
