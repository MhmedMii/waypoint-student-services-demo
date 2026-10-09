import type { ServiceCode } from '../application'
import type { FieldDef, RepeatGroupDef, ConditionalSectionDef } from '../applicationFieldSchema'
import { SERVICE_FORM_SCHEMAS } from './index'

export interface DescribedAnswer {
  label: string
  value: string
}

function flattenFieldDefs(
  entries: Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>
): Record<string, FieldDef> {
  return Object.fromEntries(
    entries.flatMap((entry): Array<[string, FieldDef]> => {
      if (entry.kind === 'field') return [[entry.id, entry]]
      if (entry.kind === 'conditionalSection') return Object.entries(flattenFieldDefs(entry.fields))
      return []
    })
  )
}

function flattenRepeatGroups(
  entries: Array<FieldDef | RepeatGroupDef | ConditionalSectionDef>
): Record<string, RepeatGroupDef> {
  return Object.fromEntries(
    entries.flatMap((entry): Array<[string, RepeatGroupDef]> => {
      if (entry.kind === 'repeatGroup') return [[entry.id, entry]]
      if (entry.kind === 'conditionalSection')
        return Object.entries(flattenRepeatGroups(entry.fields))
      return []
    })
  )
}

// راديو Yes/No مب جزء من options السكيما — قيمته الوحيدة الثابتة بهذي القيم
// بالضبط، فنترجمها هنا بدل ما نضيف optionsAr مصطنعة لكل حقل radio بالمشروع
const RADIO_VALUE_AR: Record<string, string> = { Yes: 'نعم', No: 'لا' }

// القيمة المخزّنة هي دايمًا النص الإنجليزي الأصلي (زي 'Self-Funded') — نعكسها
// لمقابلها العربي عن طريق موقعها بمصفوفة options، بدل ما نخزّن قيمتين
function describeFieldValue(def: FieldDef, value: string, language: 'en' | 'ar'): string {
  if (language !== 'ar') return value
  if (def.type === 'radio') return RADIO_VALUE_AR[value] ?? value
  if (def.options && def.optionsAr) {
    const index = def.options.indexOf(value)
    if (index !== -1) return def.optionsAr[index]
  }
  return value
}

function describeRepeatGroupValue(
  def: RepeatGroupDef,
  rawValue: string,
  language: 'en' | 'ar'
): DescribedAnswer[] {
  const label = language === 'ar' ? def.labelAr : def.label
  try {
    const rows: Array<Record<string, string>> = JSON.parse(rawValue)
    return rows
      .map((row, index) => ({
        label: `${label} #${index + 1}`,
        value: def.columns
          .map((col) => row[col.id])
          .filter(Boolean)
          .join(' — '),
      }))
      .filter((answer) => answer.value)
  } catch {
    return [{ label, value: rawValue }]
  }
}

export function describeApplicationFields(
  serviceCode: ServiceCode,
  fields: Record<string, string>,
  language: 'en' | 'ar' = 'en'
): DescribedAnswer[] {
  const schema = SERVICE_FORM_SCHEMAS[serviceCode]
  const fieldDefs = flattenFieldDefs(schema.fields)
  const repeatDefs = flattenRepeatGroups(schema.fields)

  return Object.entries(fields).flatMap(([id, value]) => {
    if (!value) return []
    const repeatDef = repeatDefs[id]
    if (repeatDef) return describeRepeatGroupValue(repeatDef, value, language)
    const fieldDef = fieldDefs[id]
    if (!fieldDef) return [{ label: id, value }]
    return [
      {
        label: language === 'ar' ? fieldDef.labelAr : fieldDef.label,
        value: describeFieldValue(fieldDef, value, language),
      },
    ]
  })
}
