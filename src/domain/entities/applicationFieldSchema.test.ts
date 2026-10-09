import { describe, it, expect } from 'vitest'
import { SERVICE_FORM_SCHEMAS } from './serviceFormSchemas'
import { VISA_SERVICES, EXAM_SERVICES } from './application'

describe('SERVICE_FORM_SCHEMAS', () => {
  it('has a schema for every visa and exam service code', () => {
    for (const code of [...VISA_SERVICES, ...EXAM_SERVICES]) {
      expect(SERVICE_FORM_SCHEMAS[code]).toBeDefined()
      expect(SERVICE_FORM_SCHEMAS[code].serviceCode).toBe(code)
    }
  })

  it('every field/repeatGroup/conditionalSection id is unique within a schema', () => {
    for (const schema of Object.values(SERVICE_FORM_SCHEMAS)) {
      const ids = schema.fields.map((entry) => entry.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('every document slot id is unique within a schema', () => {
    for (const schema of Object.values(SERVICE_FORM_SCHEMAS)) {
      const ids = schema.documents.map((doc) => doc.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('conditionalSection.visibleWhen and document.visibleWhen reference a real field id in the same schema', () => {
    for (const schema of Object.values(SERVICE_FORM_SCHEMAS)) {
      const topLevelIds = new Set(schema.fields.map((entry) => entry.id))
      for (const entry of schema.fields) {
        if (entry.kind === 'conditionalSection') {
          expect(topLevelIds.has(entry.visibleWhen.fieldId)).toBe(true)
        }
      }
      for (const doc of schema.documents) {
        if (doc.visibleWhen) {
          expect(topLevelIds.has(doc.visibleWhen.fieldId)).toBe(true)
        }
      }
    }
  })
})
