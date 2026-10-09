import { describe, it, expect } from 'vitest'
import { australiaStudentSchema } from './australiaStudent'
import { validateApplicationFields } from '../../validation/validateApplicationFields'
import type { SchemaEntry } from '../applicationFieldSchema'

const MAX_FIELD_COUNT = 40 // خلها متزامنة مع الحد بـ validateApplicationFields.ts

function worstCaseFieldCount(entries: SchemaEntry[]): number {
  let count = 0
  for (const entry of entries) {
    if (entry.kind === 'field') count += 1
    else if (entry.kind === 'conditionalSection') count += worstCaseFieldCount(entry.fields)
    else if (entry.kind === 'repeatGroup') count += entry.count * entry.columns.length
  }
  return count
}

describe('australiaStudentSchema', () => {
  it('stays under the 40-field submission cap even if every optional section is filled', () => {
    expect(worstCaseFieldCount(australiaStudentSchema.fields)).toBeLessThanOrEqual(MAX_FIELD_COUNT)
  })

  it('a full submission — every field, every repeat row — passes validateApplicationFields', () => {
    const fields: Record<string, string> = {}
    let n = 0
    function fill(entries: SchemaEntry[]) {
      for (const entry of entries) {
        if (entry.kind === 'field') fields[`f${n++}`] = 'x'
        else if (entry.kind === 'conditionalSection') fill(entry.fields)
        else if (entry.kind === 'repeatGroup') {
          for (let row = 0; row < entry.count; row++)
            for (const col of entry.columns) fields[`r${n++}`] = 'x'
        }
      }
    }
    fill(australiaStudentSchema.fields)

    const result = validateApplicationFields({
      kind: 'visa',
      serviceCode: 'australia-student',
      name: 'Test Applicant',
      phone: '99887766',
      fields,
    })
    expect(result).toEqual({ isValid: true })
  })

  it('charges 80 KD, per the service spec', () => {
    expect(australiaStudentSchema.serviceChargeKd).toBe(80)
  })

  // form-157n / caaw-form تحتاج parent-traveling على مستوى top-level — لو رجع أحد
  // يحطها جوّة under18-guardian-details مرة ثانية، applicationFieldSchema.test.ts
  // يمسكها، بس نضيف تحقق مباشر هنا كمان يوثق السبب
  it('keeps parent-traveling at the top level so the 157N/CAAW documents can key off it', () => {
    const topLevelIds = new Set(australiaStudentSchema.fields.map((e) => e.id))
    expect(topLevelIds.has('parent-traveling')).toBe(true)

    const form157n = australiaStudentSchema.documents.find((d) => d.id === 'form-157n')
    const caaw = australiaStudentSchema.documents.find((d) => d.id === 'caaw-form')
    expect(form157n?.visibleWhen).toEqual({ fieldId: 'parent-traveling', equals: 'Yes' })
    expect(caaw?.visibleWhen).toEqual({ fieldId: 'parent-traveling', equals: 'No' })
  })
})
